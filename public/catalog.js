var Catalog = angular.module('catalog', []);

// Allow stremio:// and magnet:// protocols
Catalog.config([ '$compileProvider', function($compileProvider) {   
	$compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|stremio|magnet):/);
}]);

// Initiate the client to the add-ons
Catalog.factory("stremio", ["$http", "$rootScope", "$location", function($http, $scope, $location) {
	var Stremio = require("stremio-addons");
	var stremio = new Stremio.Client();

	// Hardcode default official Stremio add-ons - Cinemeta (IMDB metadata), Guidebox (iTunes/Hulu/Netflix/etc. links), Channels (YouTube), Filmon
	stremio.official = ["http://cinemeta.strem.io/stremioget", "http://guidebox.strem.io/stremioget", "http://channels.strem.io/stremioget", "http://filmon.strem.io/stremioget"];
	stremio.thirdparty = [];

	var add = stremio.add.bind(stremio);

	var addonUrl = $location.search().addon;
	if (addonUrl) add(addonUrl);

	stremio.official.forEach(add);

	// Load add-ons from the central tracker
	$http.get("http://api9.strem.io/addons5").success(function(res) {
		stremio.official = res.official;
		stremio.thirdparty = res.thirdparty;
		res.official.forEach(add); res.thirdparty.forEach(add);
	}).error(function(er) { console.error("add-ons tracker", er) });

	// VERY important -  update the scope when a new add-on is ready
	stremio.on("addon-ready", _.debounce(function() { !$scope.$phase && $scope.$apply() }, 300))

	return stremio;
}]);

// Requests: this is for requesting streams from the add-ons system
Catalog.factory("requests", ["stremio", function(stremio) {	
	var requests = { };
	var EventEmitter = require("EventEmitter");
    requests.candidates = function(args, callback, offlineOnly)
    {
        var handle = new EventEmitter(), updated = _.debounce(function() { handle.emit("updated") }, 200);
        handle.candidates = [];
        handle.query = angular.copy(args.query);

        var recv = 0, sent = 0, count = function(fn, id) { 
            sent++; 
            return function() { recv++; fn.apply(null, arguments); if (recv === sent) handle.emit("finish"); } 
        };

        // If we have a group that firts specifically to the arguments, discard the others ; true to .get as "noPicker"
        var services = stremio.get("stream.find", args).filter(function(x) { return x.initialized }), 
            max = (services[0] && services[0].manifest.filter) ? stremio.checkArgs(args, services[0].manifest.filter) : false,
        services = services.filter(function(x) { return stremio.checkArgs(args, x.manifest.filter) >= max });

        // Group by identifier, and fallthrough within each group
        args.stremio_rushed = true; // indicate to addons client to try the next one too if we don't get a quick response
        if (!offlineOnly) _.chain(services).groupBy(function(x) { return x.identifier() }).each(function(group, id) {
            stremio.fallthrough(group, "stream.find", args, count(function(err, resp, addon) {
                if (err) console.error(err);

                add((Array.isArray(resp) ? resp : []).filter(function(x) { return x }).map(function(x) { 
                    x.addon = addon;
                    x._id = x.infoHash || x.url || x.externalUrl || x.yt_id; /// for _.uniq
                    return x;
                }));
            }));
        }).value();

        function add(resp) {
            var len = handle.candidates.length, hadFirst = !!handle.first;
            handle.candidates = _.uniq(handle.candidates.concat(resp || []), function(x) { return x._id });
            handle.selected = handle.first = handle.candidates[0];

            if (handle.candidates.length > len || !hadFirst) updated();
            if (handle.first && handle.first.isPlayable && !handle.first.isExternal) handle.emit("viable");
        };

        handle.on("finish", function() { handle.finished = true }); 

        return handle;
    };

	return requests;
}])

// Metadata model
var useAsId = ["imdb_id", "yt_id", "filmon_id", "streamfeed_id"]; // TODO: load from add-ons
Catalog.factory('metadata', function() {
	return function metadata(meta) {
		var self = this;
		_.extend(self, meta);

		Object.defineProperty(self, "id", { enumerable: true, get: function() {
			if (self.imdb_id) return self.imdb_id;
			for (var i=0; i!=useAsId.length; i++) if (self[useAsId[i]]) return useAsId[i]+":"+self[useAsId[i]];
		} });
		
		self.getQuery = function(extra) {
			var query = _.extend({ type: self.type }, _.pick(self, useAsId));
			if (self.type == "series") _.extend(query, { season: 1, episode: 1 });
			//if (type == "channel") // yt_id
			if (extra) _.extend(query, extra);
			return query;
		};

	};
});

Catalog.factory('Items', [ 'stremio', 'metadata', '$rootScope', '$location', function(stremio, metadata, $scope, $location) {
	var self = { loading: true };

	var genres = self.genres = { };
	var items = [];

	var delayedApply = _.debounce(function() { !$scope.$phase && $scope.$apply() }, 300);

	// Get all supported types of the stremio addons client - e.g. movie, series, channel
	var types = [], i = 0;
	$scope.$watch(function() { return types = Object.keys(stremio.supportedTypes).sort() }, _.debounce(function() {
		types.forEach(function(type) {
			// Query for each type - the add-ons client will automagically decide which add-on to pick for each type
			stremio.meta.find({ query: { type: type }, limit: 200, skip: 0, complete: true, popular: true, projection: "lean" }, function(err, r, addon) {
				if (++i == types.length) self.loading = false;
				delayedApply();

				if (!r) return;
            	
            	// Same message as Desktop app
            	console.log("Discover pulled "+r.length+" items from "+(addon && addon.url));

				items = items.concat(r.map(function(x) { return new metadata(x) }));
				items.forEach(function(x) { 
					if (! genres[x.type]) genres[x.type] = { };
					if (x.genre) x.genre.forEach(function(g) { genres[x.type][g] = 1 });
				});
			});
		});
	}, 500), true);

	self.all = function() { return items };

	return self;
}]);


Catalog.controller('CatalogController', ['Items', 'stremio', '$scope', '$timeout', '$window', 'requests', function CatalogController(Items, stremio, $scope, $timeout, $window, requests) {
	var self = this;

	var imdb_proxy = '/poster/';

	self.query = ''; // TODO: search

	$scope.selected = { type: "movie", genre: null }; // selected category, genre
	$scope.isLoading = function() { return Items.loading };

	self.catTypes = {
		movie: { name: 'Movies' },
		series: { name: 'TV Shows' },
		channel: { name: 'Channel' },
		tv: { name: 'TV channels' },
	};
	self.genres = Items.genres;

	$scope.$watchCollection(function() { return [$scope.selected.type, $scope.selected.genre, Items.all().length] }, function() {
		self.items = Items.all().filter(function(x) { 
			return (x.type == $scope.selected.type) && 
				(!$scope.selected.genre || (x.genre && x.genre.indexOf($scope.selected.genre) > -1))
		});
		$scope.selected.item = self.items[0];
	});

	// Get all streams for an item
	$scope.$watch(function() { return $scope.selected.item && $scope.selected.item.id }, function() {
		$scope.handle = null;
		if (! $scope.selected.item) return;

		$scope.handle = requests.candidates({ query: $scope.selected.item.getQuery() }).on("updated", function() {
			!$scope.$phase && $scope.$digest();
		});
	});

	self.formatImgURL = function formatImgURL(url, width, height) {
		if (!url || -1 === url.indexOf("imdb.com")) return url;

		var splitted = url.split("/").pop().split(".");

		if (1 === splitted.length) return url;

		return imdb_proxy + encodeURIComponent(url.split("/").slice(0,-1).join("/") + "/" + splitted[0] + "._V1._SX" + width + "_CR0,0," + width + "," + height + "_.jpg");
	};

	return self;
}]); 


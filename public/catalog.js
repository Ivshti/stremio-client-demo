var Catalog = angular.module('catalog', []);

// Allow stremio:// protocol
Catalog.config([ '$compileProvider', function($compileProvider) {   
	$compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|stremio):/);
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
			var query = { type: self.type };
			for (var i=0; i!=useAsId.length; i++) if (self[useAsId[i]]) query[useAsId[i]] = self[useAsId[i]];
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


Catalog.controller('CatalogController', ['Items', 'stremio', '$scope', '$timeout', '$window', '$q', function CatalogController(Items, stremio, $scope, $timeout, $window, $q) {
	var self = this;

	var imdb_proxy = '/poster/';

	self.query = ''; // TODO: search

	$scope.selected = { type: "movie", genre: null }; // selected category, genre

	self.catTypes = {
		movie: { name: 'Movies' },
		series: { name: 'TV Shows' },
		channel: { name: 'Channel' },
		tv: { name: 'TV channels' },
	};
	self.genres = Items.genres;

	$scope.$watch(function() { return Items.loading }, function(l) { $scope.loading = l }); 

	$scope.$watchCollection(function() { return [$scope.selected.type, $scope.selected.genre, Items.all().length] }, function() {
		self.items = Items.all().filter(function(x) { 
			return (x.type == $scope.selected.type) && 
				(!$scope.selected.genre || (x.genre && x.genre.indexOf($scope.selected.genre) > -1))
		});
		$scope.selected.item = self.items[0];
	});

	// Get all streams for an item
	$scope.$watch(function() { return $scope.selected.item && $scope.selected.item.id }, function() {
		if (! $scope.selected.item) return;

		// TODO: find from all sources
		stremio.stream.find({ query: $scope.selected.item.getQuery() }, function(err, res) { 
			if (!$scope.selected.item) return;
			$scope.selected.item.streams = res;
			$scope.$apply();
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


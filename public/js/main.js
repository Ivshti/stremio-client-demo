var app = angular.module('app', []);

// Allow stremio:// and magnet:// protocols
app.config([ '$compileProvider', function($compileProvider) {   
	$compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|stremio|magnet):/);
}]);

// Initiate the client to the add-ons
app.factory("stremio", ["$http", "$rootScope", "$location", function($http, $scope, $location) {
	var Stremio = require("stremio-addons");
	var stremio = new Stremio.Client();

	// Default auth token for open-source projects ; not required for stremioget end-points
	stremio.setAuth("http://api9.strem.io", "2a240788ce82492744cdd42ca434fc26848ec616");

	// Hardcode default official Stremio add-ons - Cinemeta (IMDB metadata), Guidebox (iTunes/Hulu/Netflix/etc. links), Channels (YouTube), Filmon
	stremio.official = ["http://cinemeta.strem.io/stremioget", "http://guidebox.strem.io/stremioget", "http://channels.strem.io/stremioget", "http://filmon.strem.io/stremioget"];
	stremio.thirdparty = [];

	var add = stremio.add.bind(stremio);

	var addonUrl = $location.search().addon;
	console.log("Adding add-on "+addonUrl);
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
app.factory("requests", ["stremio", function(stremio) {	
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
app.factory('metadata', function() {
	return function metadata(meta) {
		var self = this;
		_.extend(self, meta);

		// auto-generate id from useAsId properties
		Object.defineProperty(self, "id", { enumerable: true, get: function() {
			if (self.imdb_id) return self.imdb_id;
			for (var i=0; i!=useAsId.length; i++) if (self[useAsId[i]]) return useAsId[i]+":"+self[useAsId[i]];
		} });
		
		// this gets passed to stream.find add-on method
		self.getQuery = function(extra) {
			var query = _.extend({ type: self.type }, _.pick(self, useAsId));
			if (self.type == "series") _.extend(query, { season: 1, episode: 1 });
			if (extra) _.extend(query, { yt_id: extra.id, season: extra.season, episode: extra.number });
			return query;
		};

	};
});


app.run(['$rootScope', function($scope) {
	$scope.view = "discover";

	$scope.catTypes = {
		movie: { name: 'Movies' },
		series: { name: 'TV Shows' },
		channel: { name: 'Channel' },
		tv: { name: 'TV channels' },
	};


	var IMDB_PROXY = '/poster/';
	$scope.formatImgURL = function formatImgURL(url, width, height) {
		if (!url || -1 === url.indexOf("imdb.com")) return url;

		var splitted = url.split("/").pop().split(".");
		if (1 === splitted.length) return url;

		return IMDB_PROXY + encodeURIComponent(url.split("/").slice(0,-1).join("/") + "/" + splitted[0] + "._V1._SX" + width + "_CR0,0," + width + "," + height + "_.jpg");
	};

}]);

app.controller('discoverCtrl', ['stremio', '$scope', 'metadata', function mainController(stremio, $scope, metadata) {
	var PAGE_LEN = 140;

	$scope.sorts = [{ name: "Popularity", prop: "popularity" }];

	$scope.selected = { type: "movie", genre: null, limit: PAGE_LEN, sort: $scope.sorts[0].prop }; // selected category, genre
	
	var loading = true, genres = $scope.genres = { }, items = [];

	var delayedApply = _.debounce(function() { !$scope.$phase && $scope.$apply() }, 300);

	// Get all supported types of the stremio addons client - e.g. movie, series, channel
	function receiveItems(err, r, addon) {
		if (err) console.error(err);
		if (!r) return;
		
		delayedApply();

		// Same message as Desktop app
		console.log("Discover pulled "+r.length+" items from "+(addon && addon.url));

		items = items.concat(r.map(function(x) { return new metadata(x) }));
		items.forEach(function(x) { 
			if (! genres[x.type]) genres[x.type] = { };
			if (x.genre) x.genre.forEach(function(g) { genres[x.type][g] = 1 });
		});
	};

	// Load initial data for each type
	var types = [], i = 0;
	$scope.$watch(function() { return types = Object.keys(stremio.supportedTypes).sort() }, _.debounce(function() {
		types.forEach(function(type) {
			// Query for each type - the add-ons client will automagically decide which add-on to pick for each type
			stremio.meta.find({ query: { type: type }, limit: PAGE_LEN, skip: 0, complete: true, popular: true, projection: "lean" }, function(err, r, addon) {
				if (++i == types.length) loading = false;
				receiveItems(err, r, addon);
			});
		});
	}, 500), true);

	// Reset page on every change of type/genre/sort
	var askedFor;
	$scope.$watchCollection(function() { return [$scope.selected.type, $scope.selected.genre, $scope.selected.sort] }, function() {
		$scope.selected.limit = PAGE_LEN;
		$scope.selected.sort = $scope.sorts[0].prop;
		askedFor = PAGE_LEN;
	});

	// Update displayed items, load more items
	$scope.$watchCollection(function() { return [$scope.selected.type, $scope.selected.genre, $scope.selected.sort, $scope.selected.limit, items.length] }, function() {		
		$scope.items = items //_.sortByOrder(items, [$scope.selected.sort], ['desc'])
		.filter(function(x) { 
			return (x.type == $scope.selected.type) && 
				(!$scope.selected.genre || (x.genre && x.genre.indexOf($scope.selected.genre) > -1))
		}).slice(0, $scope.selected.limit);
		$scope.selected.item = $scope.items[0];

		var limit = $scope.selected.limit;
		if ($scope.items.length<limit && askedFor != limit) stremio.meta.find({ 
			query: _.pick(_.pick($scope.selected, "type", "genre"), _.identity),
			limit: PAGE_LEN, skip: limit-PAGE_LEN
		}, function(err, r, addon) {
			askedFor = limit;
			receiveItems(err, r, addon);
		});
	});

	$scope.isLoading = function() { return loading };

	$scope.loadNextPage = function() {
		$scope.selected.limit += PAGE_LEN;
	}

	return self;
}]); 

app.controller('searchCtrl', ['stremio', 'metadata', '$scope', function(stremio, metadata, $scope) {
	var searchProj = { name: 1, poster: 1, type: 1, popularity: 1, imdbRating: 1, description: 1 };
	useAsId.forEach(function(id) { searchProj[id] = 1 });

	$scope.selected = { item: null };

	$scope.results = { all: {}, prio: {} }; $scope.groups = [];

	$scope.search = function() { 
		console.log("search for "+$scope.searchQuery);

		$scope.results = { all: {}, prio: {} }; $scope.groups = [];
	
		// get all meta.search-supporting add-ons		
		stremio.get("meta.search").forEach(function(addon) {
			addon.call("meta.search", [stremio.getAuth(), { 
				query: $scope.searchQuery, limit: 10,
				projection: searchProj
			}], function(skip, err, error, result) {
				if (skip) return;
				if (! (result && result.results)) return;

				var results = result.results.map(function(item) { return new metadata(item) });
				$scope.results.all[addon.identifier()] = results; // group results by identifier
				if (results[0] && (results[0].type=="movie" || results[0].type=="series")) $scope.results.prio[results[0].type] = 1; // bump the type of the first result
				$scope.updateGroups();
				
				$scope.$digest();
			}, true);
		});
	};
	
	$scope.updateGroups = function() {
		var all = _.reduce($scope.results.all, function(a,b) { return a.concat(b) }, []);
		$scope.groups = _.chain(all).groupBy("type")
			.map(function(items){ return { items: items, type: items[0].type } })
			.sortBy(function(group) { return $scope.results.prio[group.type] })
			.value();
		$scope.noResults = $scope.searchQuery && (all.length == 0);

		$scope.selected.item = all[0];
	};

	$scope.closeSearch = function() {
		$scope.searchQuery = ""; 
		$scope.groups = [];
		$scope.noResults = false;
	};

	$scope.$watch("searchQuery", function(s) { if(!s) $scope.closeSearch() });
	$scope.$watch(function(){ return $scope.view }, function(tab) { $scope.closeSearch() });
}]);

app.controller('infobarCtrl', ['stremio', '$scope', 'requests', function(stremio, $scope, requests) {
	// Get all streams for an item; belongs to infobar
	var delayedDigest = _.debounce(function() { !$scope.$phase && $scope.$digest() }, 300);
	$scope.$watch(function() { return $scope.selected.item && $scope.selected.item.id }, function() {
		$scope.handle = null;
		$scope.selected.video = null;
		if (! $scope.selected.item) return;

		stremio.meta.get({ query: $scope.selected.item.getQuery() }, function(err, fullmeta) {
			if (fullmeta && $scope.selected.item) { 
				_.extend($scope.selected.item, fullmeta);
				delayedDigest();
				$scope.selected.video = fullmeta.episodes ? fullmeta.episodes[0] : (fullmeta.uploads ? fullmeta.uploads[0] : null);
			}
		});
	});
	$scope.$watch(function() { return $scope.selected.video || $scope.selected.item }, function() {
		$scope.handle = null;
		if (! $scope.selected.item) return;
		$scope.handle = requests.candidates({ query: $scope.selected.item.getQuery($scope.selected.video) }).on("updated", delayedDigest);
	}, true);


	$scope.getVidName = function(vid) {
		if (vid.hasOwnProperty("season")) return "("+vid.season+"x"+vid.number+") "+vid.name;
		else return vid.title;
	};

	$scope.streamName = function(stream) {
		return stream.name || (stream.addon && stream.addon.manifest && stream.addon.manifest.name) || (stream.addon && stream.addon.url)
	};
}]);

app.controller('addonsCtrl', ['stremio', '$scope', function(stremio, $scope) {
	$scope.stremio = stremio;

	$scope.enabled = { };

	$scope.identifiers = function() {
		return _.uniq(stremio.get().map(function(x) { return x.identifier() }))
	};

	$scope.add = function() {
		stremio.add($scope.addonUrl);
		$scope.addonUrl = "";
	}

	$scope.getType = function(url) {
		if (stremio.official.indexOf(url) > -1) return "official";
		if (stremio.thirdparty.indexOf(url) > -1) return "third party";
		return "user";
	}

}])

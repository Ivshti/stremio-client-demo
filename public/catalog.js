var Catalog = angular.module('catalog', []);

Catalog.config([ '$compileProvider', function($compileProvider) {   
	$compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|stremio):/);
}]);

Catalog.factory('Items', [ '$q', '$rootScope', '$location', function($q, $scope, $location) {
	var Client = require("stremio-addons").Client;
	var addons = new Client();

	var self = { addons: addons };

	addons.add("http://cinemeta.strem.io/stremioget");
	addons.add("http://channels.strem.io/stremioget");

	var addonUrl = $location.search().addon;
	if (addonUrl) addons.add(addonUrl); 

	var genres = self.genres = {};
	var items = [];

	addons.meta.find({ query: { }, limit: 500, skip: 0, complete: true, popular: true, projection: "lean" }, function(err, r) {
		if (!r) return;

		items = r;
		items.forEach(function(x) { 
			if (! genres[x.type]) genres[x.type] = { };
			if (x.genre) x.genre.forEach(function(g) { genres[x.type][g] = 1 });
		});
		$scope.$apply();
	});

	self.all = function() { return items };

	return self;
}]);

Catalog.controller('CatalogController', ['Items', '$scope', '$timeout', '$window', '$q', function CatalogController(Items, $scope, $timeout, $window, $q) {
	var self = this;

	var imdb_proxy = '/poster/';

	self.loading = false;
	self.query = '';
	self.showType = 'movie';
	self.showGenre = '';
	self.catTypes = {
		movie: { name: 'Movies', genres: {} },
		series: { name: 'TV Shows', genres: {} }
	};
	self.genres = Items.genres;

	$scope.$watch(function() { return Items.loading }, function(loading) { self.loading = loading });
	$scope.$watchCollection(function() { return [self.showType, self.showGenre, Items.all().length] }, function() {
		self.items = Items.all().filter(function(x) { 
			return (x.type == self.showType) && 
				(!self.showGenre || (x.genre.indexOf(self.showGenre) > -1))
		});
		self.selected = self.items[0];
	});
	$scope.$watch(function() { return self.selected && self.selected.imdb_id }, function() {
		if (! self.selected) return;
		Items.addons.stream.find({ query: { imdb_id: self.selected.imdb_id } }, function(err, res) { 
			self.selected.streams = res;
			self.selected.stream = res[0]; // OBSOLETE
			$scope.$apply();
		});
	});

	self.formatImgURL = function formatImgURL(url, width, height) {
		if (!url || -1 === url.indexOf("imdb.com")) return url;

		var splitted = url.split("/").pop().split(".");

		if (1 === splitted.length) return url;

		return imdb_proxy + encodeURIComponent(url.split("/").slice(0,-1).join("/") + "/" + splitted[0] + "._V1._SX" + width + "_CR0,0," + width + "," + height + "_.jpg");
	};


	self.selectGenre = function selectGenre(genre) {
		if(self.showGenre === genre) return;
		self.showGenre = genre;
	};

	self.selectType = function selectType(type) {
		if (self.showType === type) return;
		self.showType = type;
		self.showGenre = '';
	};

	self.selectMovie = function selectMovie(movie) {
		self.selected = movie;
	};

	return self;
}]); 


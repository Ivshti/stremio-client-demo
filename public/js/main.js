var app = angular.module('app', []);

// Allow stremio:// and magnet:// protocols
app.config([ '$compileProvider', function($compileProvider) {   
	$compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|stremio|magnet):/);
}]);


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

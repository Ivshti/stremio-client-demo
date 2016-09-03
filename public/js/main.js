var app = angular.module('app', []);

// Allow stremio:// and magnet:// protocols
app.config([ '$compileProvider', function($compileProvider) {   
	$compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|stremio|magnet):/);
}]);


app.run(['$rootScope', 'stremio', '$location', function($scope, stremio, $location) {
	$scope.view = "discover";

	$scope.catTypes = {
		movie: { name: 'Movies' },
		series: { name: 'TV Shows' },
		channel: { name: 'Channel' },
		tv: { name: 'TV channels' },
	};

	// Activate ?addon=
	var add = stremio.addUrl.bind(stremio);
	var addonUrl = $location.search().addon;
	if (addonUrl) console.log("Adding add-on "+addonUrl);
	if (addonUrl) add(addonUrl);

	// Activate third-party add-ons
	if (!$location.search().nothirdparty) stremio.on('addons-list', function(res) { res.thirdparty.forEach(add) });
}]);


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

	stremio.official.forEach(add);

	// Must be after official
	var addonUrl = $location.search().addon;
	console.log("Adding add-on "+addonUrl);
	if (addonUrl) add(addonUrl);

	// Load add-ons from the central tracker
	$http.get("http://api9.strem.io/addons5").success(function(res) {
		stremio.official = res.official;
		stremio.thirdparty = res.thirdparty;
		res.official.forEach(add); res.thirdparty.forEach(add);
	}).error(function(er) { console.error("add-ons tracker", er) });

	// VERY important -  update the scope when a new add-on is ready
	stremio.on("addon-ready", _.debounce(function() { !$scope.$phase && $scope.$apply() }, 300));

	stremio.on("addon-ready", function(addon) {
		var lid = addon.manifest.stremio_LID;
		if (lid) $scope.sorts.push({ name: addon.manifest.name, prop: "popularities."+lid });
		$scope.sorts = _.uniq($scope.sorts, "prop");
	})

	return stremio;
}]);


// Initiate the client to the add-ons
app.factory("stremio", ["$http", "$rootScope", function($http, $rootScope) {
	var Stremio = require("stremio-addons");
	var stremio = new Stremio.Client();

	stremio.sorts = [{ name: "Popularity", prop: "popularity" }];

	// Default auth token for open-source projects ; not required for stremioget end-points
	stremio.setAuth("http://api9.strem.io", "2a240788ce82492744cdd42ca434fc26848ec616");

	// Hardcode default official Stremio add-ons - Cinemeta (IMDB metadata), Guidebox (iTunes/Hulu/Netflix/etc. links), Channels (YouTube), Filmon
	stremio.official = ["http://cinemeta.strem.io/stremioget", "http://guidebox.strem.io/stremioget", "http://channels.strem.io/stremioget", "http://filmon.strem.io/stremioget"];
	stremio.thirdparty = [];
	stremio.all = {};

	var add = stremio.add.bind(stremio);

	stremio.official.forEach(add);

	// Load add-ons from the central tracker
	$http.get("http://api9.strem.io/addons5").success(function(res) {
		stremio.official = res.official;
		stremio.thirdparty = res.thirdparty;
		stremio.all = res.responding || {};
		res.official.forEach(add);
		stremio.emit('addons-list', res);
	}).error(function(er) { console.error("add-ons tracker", er) });

	// VERY important -  update the rootScope when a new add-on is ready
	stremio.on("addon-ready", _.debounce(function() { !$rootScope.$phase && $rootScope.$apply() }, 300));

	stremio.on("addon-ready", function(addon) {
		// Old, LID-based sort
		var lid = addon.manifest.stremio_LID;
		if (lid) stremio.sorts.push({ name: addon.manifest.sortName || addon.manifest.name, prop: "popularities."+lid, types: addon.manifest.types, addon: addon.identifier() });
		
		// New .sorts property
		if (Array.isArray(addon.manifest.sorts)) addon.manifest.sorts.forEach(function(s) { s.addon = addon.identifier(); stremio.sorts.push(s) });
		
		stremio.sorts = _.uniq(stremio.sorts, "prop");
	})

	return stremio;
}]);

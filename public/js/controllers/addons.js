

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

app.controller('searchCtrl', ['stremio', 'metadata', '$scope', function(stremio, metadata, $scope) {
	var searchProj = { name: 1, poster: 1, type: 1, popularity: 1, imdbRating: 1, description: 1 };
	useAsId.forEach(function(id) { searchProj[id] = 1 });

	$scope.selected = { item: null };

	$scope.results = { all: {}, prio: {} }; $scope.groups = [];

	$scope.search = function() { 
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
		$scope.selected.item = null;
	};

	$scope.$watch("searchQuery", function(s) { if(!s) $scope.closeSearch() });
	$scope.$watch(function(){ return $scope.view }, function(tab) { $scope.closeSearch() });
}]);

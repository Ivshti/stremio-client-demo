
app.controller('infobarCtrl', ['stremio', '$scope', 'requests', function(stremio, $scope, requests) {
	// Get all streams for an item; belongs to infobar
	var delayedDigest = _.debounce(function() { !$scope.$phase && $scope.$digest() }, 300);
	$scope.$watch(function() { return $scope.selectedItem && $scope.selectedItem.id }, function() {
		$scope.handle = null;
		$scope.selected.video = null;
		if (! $scope.selectedItem) return;

		stremio.meta.get({ query: $scope.selectedItem.getQuery() }, function(err, fullmeta) {
			if (fullmeta && $scope.selectedItem) { 
				var p = $scope.selectedItem.popularities;
				_.extend($scope.selectedItem, fullmeta);
				_.extend($scope.selectedItem, { popularities: _.extend(p, fullmeta.popularities) }); // merge that prop

				delayedDigest();
				$scope.selected.video = fullmeta.episodes ? fullmeta.episodes[0] : (fullmeta.uploads ? fullmeta.uploads[0] : null);
			}
		});
	});
	$scope.$watch(function() { return $scope.selectedItem && $scope.selectedItem.getQuery($scope.selected.video) }, function(query) {
		$scope.handle = null;
		if (! $scope.selectedItem) return;
		$scope.handle = requests.candidates({ query: query }).on("updated", delayedDigest);
	}, true);


	$scope.getVidName = function(vid) {
		if (vid.hasOwnProperty("season")) return "("+vid.season+"x"+vid.number+") "+vid.name;
		else return vid.title;
	};

	$scope.streamName = function(stream) {
		return stream.name || (stream.addon && stream.addon.manifest && stream.addon.manifest.name) || (stream.addon && stream.addon.url)
	};
}]);

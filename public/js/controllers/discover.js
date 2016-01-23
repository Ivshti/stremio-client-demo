
app.controller('discoverCtrl', ['stremio', '$scope', 'metadata', function mainController(stremio, $scope, metadata) {
	var PAGE_LEN = 140;

	$scope.selected = { type: "movie", genre: null, limit: PAGE_LEN, sort: stremio.sorts[0].prop }; // selected category, genre
	
	var loading = true, genres = $scope.genres = { }, items = [];

	var delayedApply = _.debounce(function() { !$scope.$phase && $scope.$apply() }, 300);

	// Get all supported types of the stremio addons client - e.g. movie, series, channel
	function receiveItems(err, r, addon) {
		if (err) console.error(err);
		if (!r) return;
		
		delayedApply();

		// Same message as Desktop app
		console.log("Discover pulled "+r.length+" items from "+(addon && addon.url));

		var m = _.indexBy(items, "id");
		r.forEach(function(x) { var meta = new metadata(x); m[meta.id] = meta });
		items = _.values(m);
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

	// Reset sort
	$scope.filterSort = function(type, x) { return !x.types || x.types.indexOf(type) > -1 };
	var setSort = function() {
		$scope.sorts = stremio.sorts;
		$scope.selected.sort = stremio.sorts.filter($scope.filterSort.bind(null, $scope.selected.type)).pop().prop;
	};
	$scope.$watchCollection("sorts", setSort);
	$scope.$watch("selected.type", setSort);

	// Reset page on every change of type/genre/sort
	var askedFor, lastSort
	$scope.$watchCollection(function() { return [$scope.selected.type, $scope.selected.genre, $scope.selected.sort, stremio.sorts.length] }, function() {
		$scope.selected.limit = PAGE_LEN;
		askedFor = PAGE_LEN;
	});

	// Update displayed items, load more items
	$scope.$watchCollection(function() { return [$scope.selected.type, $scope.selected.genre, $scope.selected.sort, $scope.selected.limit, items.length] }, function() {		
		var sort = $scope.selected.sort;

		$scope.items = _.sortBy(items, function(item) {
			return -(sort.match("popularities") ? item.popularities[sort.split(".")[1]] : item[sort]) // descending
		})
		.filter(function(x) {
			return (x.type == $scope.selected.type) && 
				(!$scope.selected.genre || (x.genre && x.genre.indexOf($scope.selected.genre) > -1))
		}).slice(0, $scope.selected.limit);
		$scope.selected.item = $scope.items[0];

		var limit = $scope.selected.limit;
		if ( ($scope.items.length<limit && askedFor != limit) || sort != lastSort) stremio.meta.find({ 
			query: _.pick(_.pick($scope.selected, "type", "genre"), _.identity),
			limit: PAGE_LEN, skip: limit-PAGE_LEN,
			sort: _.object([sort],[-1])
		}, function(err, r, addon) {
			askedFor = limit;
			lastSort = sort;
			receiveItems(err, r, addon);
		});
	});

	$scope.isLoading = function() { return loading };

	$scope.loadNextPage = function() {
		$scope.selected.limit += PAGE_LEN;
	}

	return self;
}]); 

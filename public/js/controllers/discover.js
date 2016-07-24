
app.controller('discoverCtrl', ['stremio', '$scope', 'metadata', function mainController(stremio, $scope, metadata) {
	var PAGE_LEN = 140;

	$scope.selected = { type: "movie", genre: null, limit: PAGE_LEN, sort: null }; // selected category, genre
	
	var loading = true, genres = $scope.genres = { }, items = [];

	var delayedApply = _.debounce(function() { !$scope.$phase && $scope.$apply() }, 300);

	// Genres list
	var updateGenresFromAddons = _.debounce(function() {
		Object.keys(stremio.supportedTypes).forEach(function(type) {
			stremio.meta.find({ 
				query: { type: type }, complete: true, popular: true,
				limit: 300, projection: { type: 1, genre:1 /*, popularity: 1*/ }
			}, function(err, res) { if (res) res.forEach(addCategories); delayedApply(); });
		});
	});

	$scope.$watchCollection(function() { return Object.keys(stremio.supportedTypes).sort() }, _.debounce(function() {
		if (!_.isEmpty(stremio.supportedTypes)) updateGenresFromAddons();
	}));

    $scope.genres = { }; // genres by type

    // Categories
    var addCategories = function(meta) {
        if (! $scope.genres[meta.type]) $scope.genres[meta.type] = { };
        if (meta.genre) meta.genre.forEach(function(g) { $scope.genres[meta.type][g] = true });

        // WARNING: meta.categories can also be used for items which have .genre; we'll clutter the UI though
    };

	// Sorts
	var defaultSorts = [
		{ prop: null, name: "SORT_TRENDING" },
		{ prop: "imdbRating", name: "SORT_RATING", types: ["movie", "series"], addon: "com.linvo.cinemeta" },
		{ prop: "name", name: "SORT_ALPHABET", types: ["movie", "series"], addon: "com.linvo.cinemeta" },
		{ prop: "released", name: "SORT_YEAR", types: ["movie", "series"], addon: "com.linvo.cinemeta" }
		// consider year
	];
	$scope.sorts = [].concat(defaultSorts); // we set it on updateSelected

	$scope.$watchCollection(function() { return stremio.sorts.map(function(x) { return x.prop }) }, function() {
		$scope.sorts = _.uniq(stremio.sorts.concat(defaultSorts), "prop");
		//if (!$scope.selected.userSetSort) $scope.selected.sort = $scope.sorts.filter($scope.supportSort)[0].prop;
	});

	$scope.supportSort = function(sort) {
		if (!sort) return false;
		if (sort.noDiscoverTab) return false;
		return !sort.types || sort.types.indexOf($scope.selected.type) > -1;
	}

	/* 
	 * Main query & catalogue retrieval
	 */
	var asked, loaded;
	$scope.$watch("selected", function(selected) {
		if (! selected) return;

		if ($scope.loading) return;

		$scope.loading = true;
		$scope.items = { }; // Reset list, UX touch

		//userSetItem = false;
		loaded = 0; asked = 0;

		// Build query
		var sort = selected.sort || "popularity";
		var q = {
			query: { type: selected.type },
			popular: true, complete: true,
			sort: _.object([ sort ], [ -1 ]),
			limit: 70, skip: selected.loaded,
		};
		
		if (selected.genre == "oscar") q.query.awards = { oscar: 1 }; // oscar winners special case
		else if (selected.genre) q.query.genre = selected.genre;
		
		if (sort.match("^popularities")) q.query[selected.sort] = { $gt: 0 }; // only popular items
		if (sort.match("popularity")) q.query.poster = { $nin: [null, "", "N/A"] }; // default sort, add that to query; LEGACY
		if (sort.match("released")) { q.limit = 420; q.sort = { "popularities.moviedb": -1 } }; // year-based sort, show movies for a lot of years

		// Pick add-ons
		var addons = stremio.get("meta.find", q);
		$scope.sorts.forEach(function(s) {
			if ((!s.types || s.types.indexOf(selected.type) > -1) && s.prop === sort && s.addon) {
				addons = addons.filter(function(x) { return x.identifier() === s.addon })
			}
		});

		//if (addons[0] && addons[0].manifest.countrySpecific && stremio.countryCode) q.countryCode = stremio.countryCode.toLowerCase();

		var all = [ ];

		$scope.loading = true; // WARNING: for now, we only set that on initial load; it's not good UX to set it when loading more items
		requestRes();
	
		$scope.loadNextPage = function() {
			if ($scope.selected.sort && !$scope.selected.sort.match("^popularit")) return; // no infinite scroll for non-popularity/popularities props
			if (asked > loaded) return; // no more to ask for
			requestRes();
		};

		function requestRes() {
			q.skip = loaded;
			asked = loaded + 70;
			stremio.fallthrough([].concat(addons), "meta.find", q, receiveRes);
		};

		function receiveRes(err, res, service) {
			if (Array.isArray(res)) {
				console.log("Discover pulled "+res.length+" from "+service.identifier()+" (first pick "+addons[0].identifier()+") for type "+q.query.type);
				res = res.map(function(m) { return new metadata(m) });
				all = _.uniq(all.concat(res), "_id");
				loaded = all.length;

				//$scope.items = groupResults(selected, all);
				$scope.items = all;

				//if (!sc) $scope.info = (all[0] && all[0].tvguide_short) ? null : all[0];
			}

			$scope.loading = false;
			delayedApply();
		}
	}, true);

	$scope.selectItem = function(item) {
		$scope.selectedItem = item;
	}

	return self;
}]); 

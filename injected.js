	/*
	--------------------------------------------
	Preamble:
	I'm not a js programmer, so I'm not worried
	about the correct use of code styles.
	It is important for me that it just works.
	--------------------------------------------

	Copyright (C) 2021  Beresnev Alexey

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>
	*/



	async function get_playlist(owner, playlist_id) {
		url = "https://music.yandex.ru/handlers/playlist.jsx?owner=" + owner + "&kinds=" + playlist_id + "&light=false&lang=ru&external-domain=music.yandex.ru";

		var playlist = null;

		await $.get(url).done(function(data) {
			playlist = data.playlist;
		});
		return playlist;
	}


	// data = [{"op":"move","from":1, "to":0,"tracks":[{"id":"2201582","albumId":220390}]}]

	async function playlist_patch(owner_id, playlist_id, data, revision_id) {
		// [{"op":"move","from":9,"to":8,"tracks":[{"id":"2191979","albumId":216924} ]}]

		url = "https://music.yandex.ru/handlers/playlist-patch.jsx";
		await $.post(url, {
			owner: owner_id,
			kind: playlist_id,
			revision: revision_id,
			diff: JSON.stringify(data),
			lang: "ru",
			sign: Mu['authData']['user']['sign'],
			experiments: JSON.stringify(Mu['experiments']),
			"external-domain": "music.yandex.ru"
		}).done(function(data) {
			console.log('done');
		}).error(function(data){
			console.log(data);
		});
	}

	function get_name(item, sort_by_name=false) {
		/*
			Get string for item in tracks
			for compare purpuses.
		*/
		if(sort_by_name) {
			let a_name = item['title'];
			let a_artists = " - ";

			item['artists'].forEach(function(art) {
				a_artists += art['name'] + ", ";
			});
			a_name += a_artists;
			return a_name;
		} else {
			let a_name = "";

			item['artists'].forEach(function(art) {
				a_name += art['name'] + ", ";
			});
			a_name = a_name + " - " + item['title'];
			return a_name;
		}
	}

	function get_track_ids(tracks) {
		/*
			Get track ids for playlist_patch function.
		*/
		var track_ids = [];
		for(i=0; i < tracks.length; i++) {
			if( tracks[i]["albums"] > 0) {
				track_ids.push({
					"id": tracks[i]["id"],
					"albumId": tracks[i]["albums"][0]["id"]
				});
			} else {
				track_ids.push({
					"id": tracks[i]["id"]
				});
			}
		}
		return track_ids;
	}

	async function sort_items() {

		var username = Mu['authData']['user']['login'];
		var playlist_id = Mu['settings']['pathname'].split("/");
		playlist_id = playlist_id[playlist_id.length - 1];

		playlist = await get_playlist(username, playlist_id);
		revision_id = playlist['revision']
		tracks = playlist["tracks"];
		// sort has been borrowed from here: https://stackoverflow.com/questions/282670/easiest-way-to-sort-dom-nodes
		tracks.sort(function(a, b) {
			let a_name = get_name(a);
			let b_name = get_name(b);

			return a_name == b_name
			  ? 0
			  : (a_name > b_name ? 1 : -1);
		});
		console.log('sorted, send to server');

		var track_ids = get_track_ids(tracks);
		// insert tracks first
		patch_data = [{"op":"insert","at":0,"tracks":track_ids}];
		await playlist_patch(Mu['authData']['user']['uid'], playlist_id, patch_data, revision_id);
		// delete tracks
		delete_data = [{"op":"delete","from":tracks.length,"to": tracks.length * 2}];
		await playlist_patch(Mu['authData']['user']['uid'], playlist_id, delete_data, revision_id + 1);
		// reload page (stupid, but I don't find proper way)
		location.reload(true);
		console.log('sort items clicked');
	}

	async function del_duplicates() {

		/*
			Compare each item with others and
			call "click()" method for
			"d-track__delete" DOM element.
		*/
		let username = Mu['authData']['user']['login'];
		let playlist_id = Mu['settings']['pathname'].split("/");
		playlist_id = playlist_id[playlist_id.length - 1];

		playlist = await get_playlist(username, playlist_id);
		revision_id = playlist['revision']
		tracks = playlist["tracks"];

		// delete duplicates
		let track_count = tracks.length;
		let list = tracks;
		list = list.reduce((accumulator, thing) => {
			if (!accumulator.filter((duplicate) => get_name(thing) === get_name(duplicate))[0]) {
				accumulator.push(thing);
			}
			return accumulator;
		}, []);
		tracks = list;

		var track_ids = get_track_ids(tracks);

		// insert tracks first
		patch_data = [{"op":"insert","at":0,"tracks":track_ids}];
		await playlist_patch(Mu['authData']['user']['uid'], playlist_id, patch_data, revision_id );
		// delete tracks
		delete_data = [{"op":"delete","from":tracks.length,"to": tracks.length + track_count}];
		await playlist_patch(Mu['authData']['user']['uid'], playlist_id, delete_data, revision_id + 1);
		// reload page (stupid, but I don't find proper way)
		location.reload(true);
		console.log('delete duplicates clicked');
	}

	function injected_main() {
		// work only at pages with playlists
		var context_menu_tab_div = document.getElementsByClassName("d-context-menu__tab_main")[0];
		if (context_menu_tab_div != undefined) {

			var context_menu_list = context_menu_tab_div.getElementsByClassName("d-context-menu__list");
			if(context_menu_list.length >= 1) {
				// console.log('context_menu_div not null', context_menu_div);

				for (i = 0; i < context_menu_list.length; i++) {
					var context_menu_list_item = context_menu_list[i];

					var context_menu_of_playlist = false;
					var sort_menu_injected = false;
					var del_duplicates_menu_injected = false;
					var child_nodes = context_menu_list_item.children;

					for (j = 0; j < child_nodes.length; j++) {
						if (child_nodes[j].classList.contains("d-context-menu__item_delete")) {
							context_menu_of_playlist = true;
						}
						if (child_nodes[j].classList.contains("d-context-menu__item_sort")) {
							sort_menu_injected = true;
						}
						if (child_nodes[j].classList.contains("d-context-menu__item_del_duplicates")) {
							del_duplicates_menu_injected = true;
						}
					}
                    if (context_menu_of_playlist == true) {

                        // sort button
                        if (sort_menu_injected == false) {
                            // console.log('sort_menu_div is null');

                            var sort_button = document.createElement("li");
                            sort_button.classList.add("d-context-menu__item");
                            sort_button.classList.add("deco-popup-menu__item");
                            sort_button.classList.add("d-context-menu__item_sort");
                            sort_button.onclick = sort_items;

                            var span = document.createElement("span");
                            span.classList.add("d-context-menu__item-icon");

                            var span_icon = document.createElement("span");
                            span_icon.classList.add("d-icon");
                            span_icon.classList.add("deco-icon");
                            span_icon.classList.add("d-icon_sun");

                            var span_image = document.createElement("img");
                            span_image.width = 24;
                            span_image.height = 24;
                            if (document.getElementsByTagName("body")[0].classList.contains('theme-black')) {
                                span_image.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAMAAAD04JH5AAAC73pUWHRSYXcgcHJvZmlsZSB0eXBlIGV4aWYAAHja7ZZtjtwgDIb/c4oeAdsYm+MQCFJv0OP3hXx0Z3ZX2qr7p9KECTCOeQE/DjNh//VzhB+4qFgKSc1zyTniSiUVruh4PK66aopp1eu6HuH7gz3cDxgmQSvngHz6X3a6BY6moqdvhdr5YHt8UNKp709C50QyV8To9FOonELCxwM6BeqxrZiL29stbPvR9msnftxhVkyHG9u5iqfvyRC9rphHmHchiahZ+FiAzJuCVHQEtchyXP0oadXXVhGQj+IU36wqPFO5e/SJ/QmK5MMeYHgMZr7bD+2kHwc/rBC/mVnaPfOD3eSe4iHI8x6jexhjP3ZXU0ZI87mpayurB8cNIZc1LKMYbkXfVikoHpC9Dch7bHFDaVSIgWVQok6VBu2rbdSwxMQ7G1rmBlDT5mJcuEkMgJlmocEmRbo4yDXgFVj5XgutecuarpFj4k7wZIIYzVQIs/qO8qnQGDPliaLfscK6mFe+zijKrOEFIDSuPNIV4Ks8X5OrgKCuMDs2WON2SGxKZ27NPJIFWuCoaI93jayfAggR5lYshgQEYiZRyhSN2YgQRwefCiFnSbwBAalyxyo5iWTAcZ5zY4zR8mXlw4wzCyBUshjQFKlgNQ825I8lRw5VFU2qmtXUtWjNklPWnLPlefhVE0umls3MrVh18eTq2c09ePFauAgORy25WPFSSq2YtEK5YnSFQ60bb7KlTbe82eZb2WpD+rTUtOVmzUMrrXbu0nFO9Nytey+97rQjlfa06553230vex1ItSEjDR152PBRRr2pUTiwvitfp0YXNV6kpqPd1DDU7JKgeZzoZAZinAjEbRJAQvNkFp1S4jDRTWaxzDNNGavUCafTJAaCaSfWQTe7P+QeuIWU/okbX+TCRPcd5MJE9wm599w+oNbnr02LEhah+RrOoEbB6wenyo4PfpO+3oa/HfASegm9hF5CL6GX0EvovxGSgT8PBX/SfwMe5qKLov1FhwAAD4tpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+Cjx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDQuNC4wLUV4aXYyIj4KIDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+CiAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgIHhtbG5zOmlwdGNFeHQ9Imh0dHA6Ly9pcHRjLm9yZy9zdGQvSXB0YzR4bXBFeHQvMjAwOC0wMi0yOS8iCiAgICB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIKICAgIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiCiAgICB4bWxuczpwbHVzPSJodHRwOi8vbnMudXNlcGx1cy5vcmcvbGRmL3htcC8xLjAvIgogICAgeG1sbnM6R0lNUD0iaHR0cDovL3d3dy5naW1wLm9yZy94bXAvIgogICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iCiAgICB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iCiAgIHhtcE1NOkRvY3VtZW50SUQ9ImdpbXA6ZG9jaWQ6Z2ltcDphYTkxODkyYi0zNGYwLTQ3MGQtYWMyNC1mNjhmZGM1MmVhNDAiCiAgIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6NDljZGEyNDctYmQwNC00ZTViLTlhOTAtYWI2OGIyODU1ZjZkIgogICB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6ZTViYjFkZjAtN2UxYi00MDIyLTkxYmItMmZkOTM5Y2U5MTI2IgogICBHSU1QOkFQST0iMi4wIgogICBHSU1QOlBsYXRmb3JtPSJMaW51eCIKICAgR0lNUDpUaW1lU3RhbXA9IjE2MTcxMjAyNDY4NDE1OTUiCiAgIEdJTVA6VmVyc2lvbj0iMi4xMC4yMiIKICAgZGM6Rm9ybWF0PSJpbWFnZS9wbmciCiAgIHRpZmY6T3JpZW50YXRpb249IjEiCiAgIHhtcDpDcmVhdG9yVG9vbD0iR0lNUCAyLjEwIj4KICAgPGlwdGNFeHQ6TG9jYXRpb25DcmVhdGVkPgogICAgPHJkZjpCYWcvPgogICA8L2lwdGNFeHQ6TG9jYXRpb25DcmVhdGVkPgogICA8aXB0Y0V4dDpMb2NhdGlvblNob3duPgogICAgPHJkZjpCYWcvPgogICA8L2lwdGNFeHQ6TG9jYXRpb25TaG93bj4KICAgPGlwdGNFeHQ6QXJ0d29ya09yT2JqZWN0PgogICAgPHJkZjpCYWcvPgogICA8L2lwdGNFeHQ6QXJ0d29ya09yT2JqZWN0PgogICA8aXB0Y0V4dDpSZWdpc3RyeUlkPgogICAgPHJkZjpCYWcvPgogICA8L2lwdGNFeHQ6UmVnaXN0cnlJZD4KICAgPHhtcE1NOkhpc3Rvcnk+CiAgICA8cmRmOlNlcT4KICAgICA8cmRmOmxpCiAgICAgIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiCiAgICAgIHN0RXZ0OmNoYW5nZWQ9Ii8iCiAgICAgIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6NTk3YzJhZWEtZGVkNi00MjhlLWI4YmUtZWUyNWJjYzkzMzg0IgogICAgICBzdEV2dDpzb2Z0d2FyZUFnZW50PSJHaW1wIDIuMTAgKExpbnV4KSIKICAgICAgc3RFdnQ6d2hlbj0iKzA3OjAwIi8+CiAgICA8L3JkZjpTZXE+CiAgIDwveG1wTU06SGlzdG9yeT4KICAgPHBsdXM6SW1hZ2VTdXBwbGllcj4KICAgIDxyZGY6U2VxLz4KICAgPC9wbHVzOkltYWdlU3VwcGxpZXI+CiAgIDxwbHVzOkltYWdlQ3JlYXRvcj4KICAgIDxyZGY6U2VxLz4KICAgPC9wbHVzOkltYWdlQ3JlYXRvcj4KICAgPHBsdXM6Q29weXJpZ2h0T3duZXI+CiAgICA8cmRmOlNlcS8+CiAgIDwvcGx1czpDb3B5cmlnaHRPd25lcj4KICAgPHBsdXM6TGljZW5zb3I+CiAgICA8cmRmOlNlcS8+CiAgIDwvcGx1czpMaWNlbnNvcj4KICA8L3JkZjpEZXNjcmlwdGlvbj4KIDwvcmRmOlJERj4KPC94OnhtcG1ldGE+CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAKPD94cGFja2V0IGVuZD0idyI/PsIohf0AAAGFaUNDUElDQyBwcm9maWxlAAAokX2RPUjDQBiG36aKRSoKdhARyVCdLIiKOGoVilAh1AqtOphc+gdNGpIUF0fBteDgz2LVwcVZVwdXQRD8AXFzc1J0kRK/SwotYjy4u4f3vvfl7jtAqJeZZnWMA5pum6lEXMxkV8WuVwQxjD5aQzKzjDlJSsJ3fN0jwPe7GM/yr/tz9Kg5iwEBkXiWGaZNvEE8vWkbnPeJI6woq8TnxGMmXZD4keuKx2+cCy4LPDNiplPzxBFisdDGShuzoqkRTxFHVU2nfCHjscp5i7NWrrLmPfkLwzl9ZZnrNIeQwCKWIEGEgipKKMNGjHadFAspOo/7+Addv0QuhVwlMHIsoAINsusH/4PfvbXykxNeUjgOdL44zscI0LULNGqO833sOI0TIPgMXOktf6UOzHySXmtp0SOgdxu4uG5pyh5wuQMMPBmyKbtSkKaQzwPvZ/RNWaD/Fuhe8/rWPMfpA5CmXiVvgINDYLRA2es+7w619+3fmmb/fgADBHJ6m7vPpQAAAmRQTFRFjDxX////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAArQeQagAAAAF0Uk5TAEDm2GYAAAABYktHRACIBR1IAAAACXBIWXMAAALlAAAC5QEb/l57AAAAB3RJTUUH5QMeEAQG7BK5rAAAAXNJREFUeNrt2ssWAiEIgGF4/5duVWdORxERZBa/u5oLXzUqaCI0s+mvmQfD7QigekFgnKl6QwAAQHkv0OZxQI8GomPC6UjYPhQDAAAAAAAAAPoB9YXRqysjoS4AQGnW3g3bl2iYCwAAAAAAAAAA/QA2ragLALBp9YJNq0MHcwEAAAAAAAAA4BEkDjjKlp6nBgHjoztJkfePQjYwnqS5dwZ3fEGAbgMm1+otgGYD9KAwSfkJzPpr0dHiAFvgOXLYDW2BExCulpafxfcZ8wZ849csjG8JPE9Z7qTnAmg6YCpYvJk4T0/uab+XmieM77oESA1ADUBR/InAIqXnaSOBISrIE81R8kL80e03Ru0agTFt1STq/xEmLwoLhWmyUP8ADB9Ed+ZSJXDnbhcEKRmYa7V4+7r01fKL8WMCKQfI1iUlOxY7V1wGyB2A7Jxfs2mU228j20YpX5gmD4lta3Rda4Xd8aU7vkh3/BesFUt3/K9AaGXtA0K9FEQGYnk0AAAAAElFTkSuQmCC";

                            } else {
                                span_image.src = "data:image/png;base64,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";
                            }
                            span_image.classList.add("d-icon_sort");

                            span_icon.appendChild(span_image);

                            span.appendChild(span_icon);
                            sort_button.appendChild(span);

                            var span_title = document.createElement("span");
                            span_title.classList.add("d-context-menu__item-title");
                            span_title.innerHTML = "Сортировать плейлист";
                            sort_button.appendChild(span_title);


                            context_menu_list_item.appendChild(sort_button);
                        }
                        // del duplicates button
                        if (del_duplicates_menu_injected == false) {
                            // console.log('sort_menu_div is null');

                            var del_duplicates_button = document.createElement("li");
                            del_duplicates_button.classList.add("d-context-menu__item");
                            del_duplicates_button.classList.add("deco-popup-menu__item");
                            del_duplicates_button.classList.add("d-context-menu__item_del_duplicates");
                            del_duplicates_button.onclick = del_duplicates;

                            var span = document.createElement("span");
                            span.classList.add("d-context-menu__item-icon");

                            var span_icon = document.createElement("span");
                            span_icon.classList.add("d-icon");
                            span_icon.classList.add("deco-icon");
                            span_icon.classList.add("d-icon_sun");

                            var span_image = document.createElement("img");
                            span_image.width = 24;
                            span_image.height = 24;
                            if (document.getElementsByTagName("body")[0].classList.contains('theme-black')) {
                                span_image.src = "data:image/png;base64,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LTI5LyIKICAgIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIgogICAgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIKICAgIHhtbG5zOnBsdXM9Imh0dHA6Ly9ucy51c2VwbHVzLm9yZy9sZGYveG1wLzEuMC8iCiAgICB4bWxuczpHSU1QPSJodHRwOi8vd3d3LmdpbXAub3JnL3htcC8iCiAgICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyIKICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIKICAgeG1wTU06RG9jdW1lbnRJRD0iZ2ltcDpkb2NpZDpnaW1wOjllYzkzZjYzLWE5N2YtNDZlOC1iZWY5LTExMzJjYTNjZTE4NCIKICAgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo1MmMxYzFkZC1jZGIyLTRmYmYtYThkZi1mN2Q3MWNmYTMyNzUiCiAgIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo1NDhmNGM4OS03NjE1LTRkYTctYjZkZC0wNTMwNDk3Yzk2MjQiCiAgIEdJTVA6QVBJPSIyLjAiCiAgIEdJTVA6UGxhdGZvcm09IkxpbnV4IgogICBHSU1QOlRpbWVTdGFtcD0iMTYxNzEyMDIyMjA2OTYzOSIKICAgR0lNUDpWZXJzaW9uPSIyLjEwLjIyIgogICBkYzpGb3JtYXQ9ImltYWdlL3BuZyIKICAgdGlmZjpPcmllbnRhdGlvbj0iMSIKICAgeG1wOkNyZWF0b3JUb29sPSJHSU1QIDIuMTAiPgogICA8aXB0Y0V4dDpMb2NhdGlvbkNyZWF0ZWQ+CiAgICA8cmRmOkJhZy8+CiAgIDwvaXB0Y0V4dDpMb2NhdGlvbkNyZWF0ZWQ+CiAgIDxpcHRjRXh0OkxvY2F0aW9uU2hvd24+CiAgICA8cmRmOkJhZy8+CiAgIDwvaXB0Y0V4dDpMb2NhdGlvblNob3duPgogICA8aXB0Y0V4dDpBcnR3b3JrT3JPYmplY3Q+CiAgICA8cmRmOkJhZy8+CiAgIDwvaXB0Y0V4dDpBcnR3b3JrT3JPYmplY3Q+CiAgIDxpcHRjRXh0OlJlZ2lzdHJ5SWQ+CiAgICA8cmRmOkJhZy8+CiAgIDwvaXB0Y0V4dDpSZWdpc3RyeUlkPgogICA8eG1wTU06SGlzdG9yeT4KICAgIDxyZGY6U2VxPgogICAgIDxyZGY6bGkKICAgICAgc3RFdnQ6YWN0aW9uPSJzYXZlZCIKICAgICAgc3RFdnQ6Y2hhbmdlZD0iLyIKICAgICAgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo2OTdkMWYxZS02OTczLTQ2NWItOTIwOS00N2ExNjJkZTVmN2EiCiAgICAgIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkdpbXAgMi4xMCAoTGludXgpIgogICAgICBzdEV2dDp3aGVuPSIrMDc6MDAiLz4KICAgIDwvcmRmOlNlcT4KICAgPC94bXBNTTpIaXN0b3J5PgogICA8cGx1czpJbWFnZVN1cHBsaWVyPgogICAgPHJkZjpTZXEvPgogICA8L3BsdXM6SW1hZ2VTdXBwbGllcj4KICAgPHBsdXM6SW1hZ2VDcmVhdG9yPgogICAgPHJkZjpTZXEvPgogICA8L3BsdXM6SW1hZ2VDcmVhdG9yPgogICA8cGx1czpDb3B5cmlnaHRPd25lcj4KICAgIDxyZGY6U2VxLz4KICAgPC9wbHVzOkNvcHlyaWdodE93bmVyPgogICA8cGx1czpMaWNlbnNvcj4KICAgIDxyZGY6U2VxLz4KICAgPC9wbHVzOkxpY2Vuc29yPgogIDwvcmRmOkRlc2NyaXB0aW9uPgogPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg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";
                            } else {
                                span_image.src = "data:image/png;base64,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";
                            }
                            span_image.classList.add("d-icon_sort");

                            span_icon.appendChild(span_image);

                            span.appendChild(span_icon);
                            del_duplicates_button.appendChild(span);

                            var span_title = document.createElement("span");
                            span_title.classList.add("d-context-menu__item-title");
                            span_title.innerHTML = "Удалить дубликаты";
                            del_duplicates_button.appendChild(span_title);
                            context_menu_list_item.appendChild(del_duplicates_button);
                        }
                    }
				}
			}
		}
		// set timeout
		var tid = setTimeout(injected_main, 300);
	}
	injected_main();

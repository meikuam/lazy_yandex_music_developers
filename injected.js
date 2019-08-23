/*
--------------------------------------------
Preambula:
I'm not a js programmer, so I'm not worried 
about the correct use of code styles. 
It is important for me that it just works.
--------------------------------------------

Copyright (C) 2019  Beresnev Alexey

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

    var playlist_div = document.getElementsByClassName("page-playlist")[0];
    if (playlist_div != undefined) {

        // var context_menu_div = playlist_div.getElementsByClassName("d-context-menu__content_playlist");
        var context_menu_list = playlist_div.getElementsByClassName("d-context-menu__list");
        if(context_menu_list.length >= 1) {
            // console.log('context_menu_div not null', context_menu_div);
            
            for (i = 0; i < context_menu_list.length; i++) {
                var context_menu_list_item = context_menu_list[i];

                var sort_menu_injected = false;
                var del_duplicates_menu_injected = false;
                var child_nodes = context_menu_list_item.children;

                for (j = 0; j < child_nodes.length; j++) {
                    if (child_nodes[j].classList.contains("d-context-menu__item_sort")) {
                        sort_menu_injected = true;
                    }
                    if (child_nodes[j].classList.contains("d-context-menu__item_del_duplicates")) {
                        del_duplicates_menu_injected = true;
                    }
                }

                // sort button
                if(sort_menu_injected == false) {
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
                    span_image.src = "https://image.flaticon.com/icons/png/128/54/54937.png";
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
                if(del_duplicates_menu_injected == false) {
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
                    span_image.src = "https://static.thenounproject.com/png/217757-200.png";
                    span_image.classList.add("d-icon_sort");

                    span_icon.appendChild(span_image);

                    span.appendChild(span_icon);
                    del_duplicates_button.appendChild(span);

                    var span_title = document.createElement("span");
                    span_title.classList.add("d-context-menu__item-title");
                    span_title.innerHTML = "Удалить дупликаты";
                    del_duplicates_button.appendChild(span_title);
                    context_menu_list_item.appendChild(del_duplicates_button);
                }
            }
        }
    }
    // set timeout
    var tid = setTimeout(injected_main, 300);
}


$(document).ready(function() {
	$.get(chrome.extension.getURL('/injected.js'),
	function(data) {
		var script = document.createElement("script");
		script.setAttribute("type", "text/javascript");
		script.innerHTML = data;
		document.getElementsByTagName("head")[0].appendChild(script);
	}
);
});
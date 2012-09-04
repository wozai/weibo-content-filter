// ==UserScript==
// @name			眼不见心不烦（新浪微博）
// @namespace		http://weibo.com/salviati
// @license			MIT License
// @description		新浪微博（weibo.com）非官方功能增强脚本，具有屏蔽关键词、来源、外部链接，隐藏版面模块等功能
// @features		支持新版微博(V5)
// @version			1.0.0b1
// @revision		64
// @author			@富平侯
// @committers		@牛肉火箭, @JoyerHuang_悦
// @include			http://weibo.com/*
// @include			http://www.weibo.com/*
// @updateURL		https://userscripts.org/scripts/source/114087.meta.js
// @downloadURL		https://userscripts.org/scripts/source/114087.user.js
// ==/UserScript==

// 注意：使用@match替换@include将使GM_xmlhttpRequest()失效
var $blocks = [ // 模块屏蔽设置
		['Topic', '#trustPagelete_zt_hottopic', true],
		['InterestUser', '#trustPagelete_recom_interest', true],
		['InterestApp', '#trustPagelete_recom_allinone', true],
		['Notice', '#pl_rightmod_noticeboard', true],
		['HelpFeedback', '#pl_rightmod_help, #pl_rightmod_feedback, #pl_rightmod_tipstitle', true],
		['Ads', '#plc_main .W_main_r [id^="ads_"], div[ad-data], dl.feed_list'],
		['Footer', 'div.global_footer'],
		['PullyList', '#pl_content_biztips'],
		['RecommendedTopic', '#pl_content_publisherTop div[node-type="recommendTopic"]'],
		['Mood', '#pl_content_mood', true],
		['Medal', '#pl_rightmod_medal, .declist'],
		['Game', '#pl_leftNav_game'],
		['App', '#pl_leftNav_app'],
		['Tasks', '#pl_content_tasks'],
		['UserGuide', '#pl_guide_oldUser'],
		['Promotion', '#trustPagelet_ugrowth_invite', true],
		['Level', 'span.W_level_ico'],
		['Hello', 'div.wbim_hello'],
		['Balloon', 'div.layer_tips'],
		['TopComment', '#pl_content_commentTopNav'],
		['Member', '#trustPagelet_recom_member, #trustPagelet_member_zone', true],
		['MemberIcon', '.ico_member:not(.wbpShow), .ico_member_dis:not(.wbpShow)'],
		['VerifyIcon', '.approve:not(.wbpShow), .approve_co:not(.wbpShow)'],
		['DarenIcon', '.ico_club:not(.wbpShow)'],
		['VgirlIcon', '.ico_vlady:not(.wbpShow)'],
		['Custom'] // 必须为最后一项
	];
var $options;

// 工具函数
var $ = (function () {
	// 按id选择元素（默认操作）
	var $ = function (id) {
		return document.getElementById(id);
	};
	// 按CSS选择元素
	$.select = function (css, root) {
		if (!root) { root = document; }
		return root.querySelector(css);
	};
	// 对于Chrome和Opera，通过脚本注入获得unsafeWindow
	$.window = (!window.chrome) ? unsafeWindow :
			(function () {
				var e = document.createElement('p');
				e.setAttribute('onclick', 'return window;');
				return e.onclick();
			}());
	$.config = $.window.$CONFIG;
	$.uid = $.config && $.config.uid;
	$.STK = $.window.STK;
	// Chrome不支持GM_setValue(), GM_getValue()等，需要使用localStorage重新定义
	// Firefox 2+, Internet Explorer 8+, Safari 4+和Chrome均支持DOM Storage (HTML5)
	if (!GM_getValue || (GM_getValue.toString && GM_getValue.toString().indexOf("not supported")>-1)) {
		var CHROME_KEY_ROOT = 'weiboPlus.';
		$.get = function (name, defval) {
			var val = localStorage.getItem(CHROME_KEY_ROOT + name);
			return val === null ? defval : val;
		};
		$.set = function (name, value) {
			localStorage.setItem(CHROME_KEY_ROOT + name, value);
		};
	} else {
		$.get = GM_getValue;
		$.set = GM_setValue;
	}
	// 在数组中查找元素
	$.find = function (array, val) {
		var l = array.length, i;
		for (i = 0; i < l; ++i) {
			if (array[i] === val) {
				return true;
			}
		}
		return false;
	}
	// 删除节点
	$.remove = function (el) {
		if (el) { el.parentNode.removeChild(el); }
	};
	// 绑定click事件
	$.click = function (el, handler) {
		if (el) { el.addEventListener('click', handler, false); }
	};
	// 返回当前页面的位置
	$.scope = function () {
		return document.body.classList.contains('B_index') ? 1 : 
			document.body.classList.contains('B_profile') ? 2 : 0;
	};
	return $;
})();

function Options() {};

Options.prototype = {
	// 选项类型与默认值
	items : {
		whiteKeywords : ['keyword'],
		blackKeywords : ['keyword'],
		grayKeywords : ['keyword'],
		URLKeywords : ['keyword'],
		sourceKeywords : ['keyword'],
		sourceGrayKeywords : ['keyword'],
		tipBackColor : ['string', '#FFD0D0'],
		tipTextColor : ['string', '#FF8080'],
		readerMode : ['bool'],
		readerModeBackColor : ['string', 'rgba(100%, 100%, 100%, 0.8)'],
		clearHotTopic : ['bool'],
		overrideMySkin : ['bool'],
		overrideOtherSkin : ['bool'],
		skinID : ['string', 'skinvip001'],
		filterPaused : ['bool'],
		filterSmiley : ['bool'],
		filterDeleted : ['bool'],
		filterFeelings : ['bool'],
		filterDupFwd : ['bool'],
		maxDupFwd : ['string', 1],
		filterFlood : ['bool'],
		maxFlood : ['string', 5],
		autoUpdate : ['bool', true],
		floatBtn : ['bool', true],
		rightModWhitelist : ['bool'],
		customBlocks : ['array'],
		hideBlock : ['object']
	},
	// 转换为字符串
	toString : function (strip) {
		var stripped = {}, option;
		for (option in this.items) {
			// 如果需要，则去掉所有内部变量
			if (!strip || this.items[option][0] !== 'internal') {
				stripped[option] = this[option];
			}
		}
		return JSON.stringify(stripped);
	},
	// 保存设置
	save : function () {
		// 自动调用toString()
		$.set($.uid.toString(), JSON.stringify(this));
	},
	// 载入/导入设置，输入的str为undefined（首次使用时）或string（非首次使用和导入设置时）
	load : function (str) {
		var parsed = {}, option;
		// 各类型默认值
		var typeDefault = {
			keyword : [],
			string : '',
			bool : false,
			array : [],
			object : {},
			internal : null
		};
		if (str) {
			try {
				parsed = JSON.parse(str.replace(/\n/g, ''));
				if (typeof parsed !== 'object') {throw 0; }
			} catch (e) {
				parsed = {};
				str = null; // 出错，最后返回false
			}
		}
		// 填充选项
		for (option in this.items) {
			if (parsed[option] !== undefined) {
				// 优先使用成功读取的值
				this[option] = parsed[option];
			} else if (this.items[option][1] !== undefined) {
				// 使用属性默认值
				this[option] = this.items[option][1];
			} else {
				// 使用类型默认值
				this[option] = typeDefault[this.items[option][0]];
			}
		}
		return (str !== null);
	}
};

// 关键词过滤器
var $filter = (function () {
	var forwardFeeds = {}, floodFeeds = {};
	// 搜索指定文本中是否包含列表中的关键词
	var search = function  (str, key) {
		var text = str.toLowerCase(), keywords = $options[key], keyword, i, len = keywords.length;
		if (str === '' || len === 0) { return ''; }
		for (i = 0; i < len; ++i) {
			keyword = keywords[i];
			if (!keyword) { continue; }
			if (keyword.length > 2 && keyword.charAt(0) === '/' && keyword.charAt(keyword.length - 1) === '/') {
				try {
					// 尝试匹配正则表达式
					if (RegExp(keyword.substring(1, keyword.length - 1)).test(str)) {return keyword; }
				} catch (e) {
					continue;
				}
			} else if (text.indexOf(keyword.toLowerCase()) > -1) {
				return keyword;
			}
		}
		return '';
	};
	// 获取微博正文
	var converter = document.createElement('div');
	var getText = function (content) {
		// 替换表情，去掉标签
		if ($options.filterSmiley) {
			converter.innerHTML = content.innerHTML.replace(/<img[^>]+alt="(\[[^\]">]+\])"[^>]*>/g, '$1')
				.replace(/<\/?[^>]+>/g, '').replace(/[\r\n\t]/g, '').trim();
			// 利用未插入文档的div进行HTML反转义
			return converter.textContent;
		}
		return content.textContent.replace(/[\r\n\t]/g, '').trim();
	};
	// 过滤微博来源
	var searchSource = function (source, keywords) {
		if (!source) {
			source = '未通过审核应用';
		} else {
			// 过长的应用名称会被压缩，完整名称存放在title属性中
			source = source.title || source.innerHTML;
		}
		return search(source, keywords);
	}
	// 过滤单条微博
	var apply = function (feed) {
		if (feed.firstChild && feed.firstChild.className === 'wbpTip') {
			// 已被灰名单屏蔽过，移除屏蔽提示
			feed.removeChild(feed.firstChild);
		}
		var mid = feed.getAttribute('mid');
		if (!mid) { return false; } // 动态没有mid
		var scope = $.scope(), isForward = (feed.getAttribute('isforward') === '1'),
			content = feed.querySelector('.WB_detail > .WB_text'),
			forwardContent = feed.querySelector('.WB_media_expand .WB_text'),
			forwardLink = feed.querySelector('.WB_media_expand .WB_func .WB_time'),
			source = feed.querySelector('.WB_detail > .WB_func a[target="_blank"]'),
			forwardSource = feed.querySelector('.WB_media_expand > .WB_func a[target="_blank"]');
			fauthor = feed.querySelector('.WB_media_expand .WB_info > a.WB_name');
		var fmid = isForward ? (forwardLink ? forwardLink.href : null) : null,
			author = (scope === 1) ? feed.querySelector('.WB_detail > .WB_info > a.WB_name') : null,
			uid = author ? author.getAttribute('usercard') : null;

		if (!content) { return false; }
		var text = (scope === 1) ? '@' + author.getAttribute('nick-name') + ': ' : ''; 
		text += getText(content);
		if (isForward && fauthor && forwardContent) {
			// 转发内容
			text += '////@' + fauthor.getAttribute('nick-name') + ': ' + getText(forwardContent);
		}
		console.log(text);

		if ($options.filterPaused || search(text, 'whiteKeywords')) {
			// 白名单条件
		} else if ((function () { // 黑名单条件
			// 屏蔽已删除微博的转发
			if ($options.filterDeleted && isForward && feed.querySelector('.WB_media_expand > .WB_deltxt')) {
				console.warn('↑↑↑【已删除微博的转发被屏蔽】↑↑↑');
				return true;
			}
			// 屏蔽写心情微博
			if ($options.filterFeelings && feed.querySelector('dd.content > div.feelingBoxS')) {
				console.warn('↑↑↑【写心情微博被屏蔽】↑↑↑');
				return true;
			}
			// 屏蔽指定来源
			if (searchSource(source, 'sourceKeywords') ||
					(isForward && searchSource(forwardSource, 'sourceKeywords'))) {
				console.warn('↑↑↑【被来源黑名单屏蔽】↑↑↑');
				return true;
			}
			// 反版聊（屏蔽重复转发）
			if ($options.filterDupFwd && fmid && forwardFeeds[fmid]) {
				if (forwardFeeds[fmid].length >= Number($options.maxDupFwd) && !$.find(forwardFeeds[fmid], mid)) {
					console.warn('↑↑↑【被反版聊功能屏蔽】↑↑↑');
					return true;
				}
			}
			// 反刷屏（屏蔽同一用户大量发帖）
			if ($options.filterFlood && uid && floodFeeds[uid]) {
				if (floodFeeds[uid] >= Number($options.maxFlood) && !$.find(floodFeeds[uid], mid)) {
					console.warn('↑↑↑【被反刷屏功能屏蔽】↑↑↑');
					return true;
				}
			}
			// 在微博内容中搜索屏蔽关键词
			if (search(text, 'blackKeywords')) {
				console.warn('↑↑↑【被关键词黑名单屏蔽】↑↑↑');
				return true;
			}
			// 搜索t.cn短链接
			var links = feed.getElementsByTagName('A'), i, len;
			for (i = 0, len = links.length; i < len; ++i) {
				if (links[i].href.substring(0, 12) === 'http://t.cn/' && search(links[i].title, 'URLKeywords')) {
					console.warn('↑↑↑【被链接黑名单屏蔽】↑↑↑');
					return true;
				}
			}
			return false;
		})()) {
			feed.style.display = 'none'; // 直接隐藏，不显示屏蔽提示
			return true;
		} else { // 灰名单条件
			// 搜索来源灰名单
			var sourceKeyword = searchSource(source, 'sourceGrayKeywords'), 
				keyword = search(text, 'grayKeywords');
			if (!sourceKeyword && isForward) {
				sourceKeyword = searchSource(forwardSource, 'sourceGrayKeywords');
			}			
			if (keyword || sourceKeyword) {
				// 找到了待隐藏的微博
				var authorClone;
				if (scope === 1) {
					// 添加隐藏提示链接
					authorClone = author.cloneNode(false);
					authorClone.innerHTML = '@' + author.getAttribute('nick-name');
					authorClone.className = '';
				}
				var showFeedLink = document.createElement('a');
				showFeedLink.href = 'javascript:void(0)';
				showFeedLink.className = 'wbpTip';
				var keywordLink = document.createElement('a');
				keywordLink.href = 'javascript:void(0)';
				keywordLink.className = 'wbpTipKeyword';
				keywordLink.innerHTML = keyword || sourceKeyword;
				if (scope === 1) {
					showFeedLink.appendChild(document.createTextNode('本条来自'));
					showFeedLink.appendChild(authorClone);
					showFeedLink.appendChild(document.createTextNode('的微博因'));
				} else if (scope === 2) {
					showFeedLink.appendChild(document.createTextNode('本条微博因'));
				}
				showFeedLink.appendChild(document.createTextNode(keyword ? '内容包含“' : '来源名称包含“'));
				showFeedLink.appendChild(keywordLink);
				showFeedLink.appendChild(document.createTextNode('”而被隐藏，点击显示'));
				feed.insertBefore(showFeedLink, feed.firstChild);
				return true;
			}
		}
		// 显示微博并记录
		feed.style.display = '';
		if (!$options.filterPaused) {
			if ($options.filterDupFwd && fmid) {
				if (!forwardFeeds[fmid]) {
					forwardFeeds[fmid] = [];
				}
				if (!$.find(forwardFeeds[fmid], mid)) {
					forwardFeeds[fmid].push(mid);
				}
			}
			if ($options.filterFlood && uid) {
				if (!floodFeeds[uid]) {
					floodFeeds[uid] = [];
				}
				if (!$.find(floodFeeds[uid], mid)) {
					floodFeeds[uid].push(mid);
				}
			}
		}
		return false;
	}
	// 过滤所有微博
	var applyToAll = function () {
		// 过滤所有微博
		if ($.scope()) {
			var feeds = document.querySelectorAll('.WB_feed_type'), i, len;
			forwardFeeds = {}; floodFeeds = {};
			for (i = 0, len = feeds.length; i < len; ++i) { apply(feeds[i]); }
		}
	};

	// 屏蔽提示相关事件的冒泡处理
	var bindTipOnClick = function (node) { 
		if (!node) { return; }
		$.click(node, function (event) {
			var node = event.target;
			if (node && node.tagName === 'A') {
				if (node.className === 'wbpTipKeyword') {
					$settingsDialog.show();
					event.stopPropagation(); // 防止事件冒泡触发屏蔽提示的onclick事件
				} else if (node.className === 'wbpTip') {
					$.remove(node);
				}
			}
		});
	}
	bindTipOnClick($.select('div.WB_feed'));
	// 处理动态载入的微博
	document.addEventListener('DOMNodeInserted', function (event) {
		if ($.scope() === 0) { return false; }
		var node = event.target;
		//console.log(node);
		if (node.tagName === 'DIV' && node.classList.contains('WB_feed_type')) {
			// 处理动态载入的微博
			apply(node);
		} else if (node.tagName === 'DIV' && node.classList.contains('W_loading')) {
			var requestType = node.getAttribute('requesttype');
			// 仅在搜索和翻页时需要初始化反刷屏/反版聊记录
			// 其它情况（新微博：newFeed，同页接续：lazyload）下不需要
			if (requestType === 'search' || requestType === 'page') {
				forwardFeeds = {}; floodFeeds = {};
			}
		} else if (node.tagName === 'DIV' && node.classList.contains('WB_feed')) {
			// 微博列表作为pagelet被一次性载入
			bindTipOnClick(node);
			applyToAll();
		}
	}, false);

	return applyToAll;
})();

// 处理动态载入内容
function onDOMNodeInsertion(event) {
	if ($.scope() === 0) { return false; }
	var node = event.target;
	if (node.tagName === 'DIV' && node.getElementsByClassName('nfTagB').length) {
		// 由于新浪微博使用了BigPipe技术，从"@我的微博"等页面进入时只载入部分页面
		// 需要重新载入设置页面、按钮及刷新微博列表
		showSettingsBtn();
	} else if (node.tagName === 'DIV' && node.classList.contains('send_weibo')) {
		// 清除在发布框中嵌入的默认话题
		clearHotTopic();
	}
	return true;
}

// 自动检查更新
function autoUpdate() {
	// 部分自动更新代码改写自http://loonyone.livejournal.com/
	// 防止重复检查（同时打开多个窗口时），间隔至少两分钟
	var DoS_PREVENTION_TIME = 2 * 60 * 1000;
	var lastAttempt = $.get('lastCheckUpdateAttempt', 0);
	var now = new Date().getTime();

	if (lastAttempt && (now - lastAttempt) < DoS_PREVENTION_TIME) {return; }
	$.set('lastCheckUpdateAttempt', now.toString());

	// 每周检查一次，避免频繁升级
	//var ONE_DAY = 24 * 60 * 60 * 1000;
	var ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
	var lastSuccess = $.get('lastCheckUpdateSuccess', 0);
	if (lastSuccess && (now - lastSuccess) < ONE_WEEK) {return; }

	checkUpdate(true);
}

// 检查更新
function checkUpdate(auto) {
	GM_xmlhttpRequest({
		method: 'GET',
		// 只载入metadata
		url: 'http://userscripts.org/scripts/source/114087.meta.js?' + new Date().getTime(),
		headers: {'Cache-Control': 'no-cache'},
		onload: function (result) {
			if (!result.responseText.match(/@version\s+(.*)/)) { return; }
			$.set('lastCheckUpdateSuccess', new Date().getTime().toString());
			var ver = RegExp.$1;
			if (!result.responseText.match(/@revision\s+(\d+)/) || RegExp.$1 <= Number('${REV}')) {
				// 自动检查更新且并无新版本时不必提示
				// 注意不能使用!auto，因为作为click事件处理程序时auto是一个event对象
				if (auto !== true) { alert('“眼不见心不烦”已经是最新版。'); }
				return;
			}
			var features = '';
			if (result.responseText.match(/@features\s+(.*)/)) {
				features = '- ' + RegExp.$1.split('；').join('\n- ') + '\n\n';
			}
			// 显示更新提示
			if (confirm('“眼不见心不烦”新版本v' + ver + '可用。\n\n' + features + '如果您希望更新，请点击“确认”打开插件主页。')) {
				window.open('http://userscripts.org/scripts/show/114087');
			}
		}
	});
}

// 极简阅读模式（仅在个人首页生效）
function readerMode() {
	var readerModeStyles = $('wbpReaderModeStyles');
	if ($options.readerMode) {
		if (!readerModeStyles) {
			readerModeStyles = document.createElement('style');
			readerModeStyles.type = 'text/css';
			readerModeStyles.id = 'wbpReaderModeStyles';
			document.head.appendChild(readerModeStyles);
		}
		if (!$.config.isnarrow) { // 体验版
			readerModeStyles.innerHTML = '.B_index #Box_left, .B_index #Box_right, .B_index #pl_content_publisherTop, .B_index .global_footer, .B_index #wbim_box { display: none; } .B_index .global_header {top: -35px; } .B_index #Box_center { width: 800px; } .B_index .W_miniblog { background-position-y: -35px; } .B_index .W_main { padding-top: 17px; width: 845px; } .B_index .W_main_bg { background: ' + $options.readerModeBackColor + '; } .B_index .feed_list .repeat .input textarea { width: 688px; } .B_index #base_scrollToTop, .B_index #wbpShowSettingsFloat { margin-left: 424px; }';
		} else { // 传统版
			readerModeStyles.innerHTML = '.B_index #plc_main .W_main_r, .B_index #pl_content_publisherTop, .B_index .global_footer, .B_index #wbim_box { display: none; } .B_index .global_header {top: -35px; } .B_index #plc_main .W_main_c { width: 800px; } .B_index .W_miniblog { background-position-y: -35px; } .B_index #plc_main .custom_content_bg { padding-top: 30px; } .B_index .W_main_narrow { padding-top: 17px; } .B_index .W_main_narrow_bg { background: ' + $options.readerModeBackColor + '; } .B_index .feed_list .repeat .input textarea { width: 628px; }';
		}
	} else if (readerModeStyles) {
		$.remove(readerModeStyles);
	}
}

// 覆盖当前模板设置
function overrideSkin() {
	var formerStyle = $('custom_style') || $('skin_transformers'),
		skinCSS = $('wbpOverrideSkin');
	if (!formerStyle) { return; }
	if (($.uid === $.config.oid && $options.overrideMySkin) ||
		($.uid !== $.config.oid && $options.overrideOtherSkin)) {
		if (!skinCSS) {
			skinCSS = document.createElement('link');
			skinCSS.id = 'wbpOverrideSkin';
			skinCSS.type = 'text/css';
			skinCSS.rel = 'stylesheet';
			skinCSS.charset = 'utf-8';
			document.head.insertBefore(skinCSS, formerStyle);
		}
		skinCSS.href = $.config.cssPath + 'skin/' + $options.skinID
			+ '/skin' + ($.config.isnarrow ? '_narrow' : '') + ($.config.lang == "zh-tw" ? '_CHT' : '')
			+ '.css?version=' + $.config.version;
		formerStyle.disabled = true;
	} else if (skinCSS) {
		$.remove(skinCSS);
		formerStyle.disabled = false;
	}
}

// 检测按键，开关极简阅读模式
function onKeyPress(event) {
	if ($settingsDialog.isShown()) {return; }
	if ($.scope() === 1 && event.keyCode === 119) {
		$options.readerMode = !$options.readerMode;
		$options.save();
		readerMode();
	}
}

function hideBlocks() {
	var cssText = '', i, len = $blocks.length;
	$blocks[len - 1][1] = $options.customBlocks.join(', '); // 自定义屏蔽
	if ($options.rightModWhitelist) {
		// 右边栏白名单模式下，默认屏蔽右边栏除导航栏以外的所有模块
		cssText = 'body.B_index div.W_main_r > div { display: none }\n'
			+ '#pl_content_setskin, #pl_content_personInfo, #pl_nav_outlookBar { display: block }\n';
	}
	for (i = 0; i < len; ++i) {
		if ($options.hideBlock[$blocks[i][0]] && $blocks[i][1]) {
			cssText += $blocks[i][1] + ' { display: ' + (($options.rightModWhitelist && $blocks[i][2]) ? 'block' : 'none !important') + ' }\n';
		}
	}
	// 屏蔽提示相关CSS
	var tipBackColor = $options.tipBackColor;
	var tipTextColor = $options.tipTextColor;
	cssText += '.wbpTip:not(:hover) { background-color: ' + tipBackColor + '; border-color: ' + tipTextColor + '; color: ' + tipTextColor + '; }';
	// 更新CSS
	var blockStyles = $('wbpBlockStyles');
	if (!blockStyles) {
		blockStyles = document.createElement('style');
		blockStyles.type = 'text/css';
		blockStyles.id = 'wbpBlockStyles';
		document.head.appendChild(blockStyles);
	}
	blockStyles.innerHTML = cssText + '\n';
}

// 清除在发布框中嵌入的默认话题
function clearHotTopic() {
	if ($options.clearHotTopic && $.scope() === 1) {
		var inputBox = document.querySelector('#pl_content_publisherTop .send_weibo .input textarea');
		if (inputBox && inputBox.classList.contains('topic_color')) {
			// IFRAME载入方式，hotTopic可能尚未启动，直接清除相关属性即可
			inputBox.removeAttribute('hottopic');
			inputBox.removeAttribute('hottopicid');
			// 在发布框中模拟输入，欺骗STK.common.editor.plugin.hotTopic
			inputBox.value = 'DUMMY';
			inputBox.focus();
			inputBox.value = '';
			inputBox.blur();
			inputBox.classList.remove('topic_color');
		}
	}
}

// 根据当前设置修改页面
function modifyPage() {
	// 极简阅读模式
	readerMode();
	// 应用浮动按钮设置
	toggleFloatSettingsBtn();
	// 屏蔽版面内容
	hideBlocks();
	// 清除在发布框中嵌入的默认话题
	clearHotTopic();
	// 覆盖当前模板设置
	overrideSkin();
}

var $settingsDialog = (function () {
	var settingsDialog = {}, shown = false;
	var dialog, content;

	var getDom = function (node) {
		return content.getDom(node);
	};
	var bind = function (node, func, event) {
		$.STK.core.evt.addEvent(content.getDom(node), event || 'click', func);
	};

	// 从显示列表建立关键词数组
	var getKeywords = function (id) {
		if (!getDom(id).hasChildNodes()) {return []; }
		var keywords = getDom(id).childNodes, list = [], i, len;
		for (i = 0, len = keywords.length; i < len; ++i) {
			if (keywords[i].tagName === 'A') {list.push(keywords[i].innerHTML); }
		}
		return list;
	};

	// 将关键词添加到显示列表
	var addKeywords = function (id, list) {
		var keywords = list instanceof Array ? list : list.split(' '), i, len, malformed = [];
		for (i = 0, len = keywords.length; i < len; ++i) {
			var currentKeywords = ' ' + getKeywords(id).join(' ') + ' ', keyword = keywords[i];
			if (keyword && currentKeywords.indexOf(' ' + keyword + ' ') === -1) {
				var keywordLink = document.createElement('a');
				if (keyword.length > 2 && keyword.charAt(0) === '/' && keyword.charAt(keyword.length - 1) === '/') {
					try {
						// 尝试创建正则表达式，检验正则表达式的有效性
						// 调用test()是必须的，否则浏览器可能跳过该语句
						RegExp(keyword.substring(1, keyword.length - 1)).test('');
					} catch (e) {
						malformed.push(keyword);
						continue;
					}
					keywordLink.className = 'regex';
				}
				keywordLink.title = '删除关键词';
				keywordLink.setAttribute('action-type', 'remove');
				keywordLink.href = 'javascript:void(0)';
				keywordLink.innerHTML = keyword;
				getDom(id).appendChild(keywordLink);
			}
		}
		if (malformed.length > 0) {
			alert('下列正则表达式无效：\n' + malformed.join('\n'));
		}
		return malformed.join(' ');
	};

	// 返回当前设置（可能未保存）
	var exportSettings = function () {
		var options = new Options(), option;
		for (option in options.items) {
			switch (options.items[option][0]) {
			case 'keyword':
				options[option] = getKeywords(option + 'List');
				break;
			case 'string':
				options[option] = getDom(option).value;
				break;
			case 'bool':
				options[option] = getDom(option).checked;
				break;
			case 'array':
				options[option] = [];
				break;
			case 'object':
				options[option] = {};
				break;
			case 'internal':
				// 内部变量保持不变
				// WARNING: 内部变量如果是数组或对象，以下的浅拷贝方式可能导致设置的意外改变
				options[option] = $options[option];
				break;
			}
		}
		var i, len;
		for (i = 0, len = $blocks.length; i < len; ++i) {
			options.hideBlock[$blocks[i][0]] = getDom('block' + $blocks[i][0]).checked;
		}
		var blocks = getDom('customBlocks').value.split('\n'), block;
		for (i = 0, len = blocks.length; i < len; ++i) {
			block = blocks[i].trim();
			if (block) { options.customBlocks.push(block); }
		}
		getDom('settingsString').value = options.toString(true);
		return options;
	};

	// 更新设置窗口内容，exportSettings()的反过程
	var importSettings = function (options) {
		var option;
		for (option in options.items) {
			switch (options.items[option][0]) {
			case 'keyword':
				getDom(option).value = '';
				getDom(option + 'List').innerHTML = '';
				addKeywords(option + 'List', options[option]);
				break;
			case 'string':
				getDom(option).value = options[option];
				break;
			case 'bool':
				getDom(option).checked = options[option];
				break;
			}
		}
		var tipBackColor = getDom('tipBackColor').value,
			tipTextColor = getDom('tipTextColor').value,
			tipSample = getDom('tipSample');
		tipSample.style.backgroundColor = tipBackColor;
		tipSample.style.borderColor = tipTextColor;
		tipSample.style.color = tipTextColor;
		if (options.hideBlock) {
			var i, len;
			for (i = 0, len = $blocks.length; i < len; ++i) {
				getDom('block' + $blocks[i][0]).checked = (options.hideBlock[$blocks[i][0]] === true);
			}
		}
		getDom('customBlocks').value = options.customBlocks ? options.customBlocks.join('\n') : '';
		getDom('settingsString').value = options.toString(true);
	};

	// 创建设置窗口
	var createDialog = function () {
		dialog = $.STK.ui.dialog({isHold: true});
		dialog.setTitle('“眼不见心不烦”(v${VER})设置');
		content = $.STK.module.layer('${HTML}');
		dialog.setContent(content.getOuter());
		// 修改屏蔽提示颜色事件
		bind('tipBackColor', function () {
			getDom('tipSample').style.backgroundColor = this.value;
		}, 'blur');
		bind('tipTextColor', function () {
			getDom('tipSample').style.borderColor = this.value;
			getDom('tipSample').style.color = this.value;
		}, 'blur');
		var events = $.STK.core.evt.delegatedEvent(content.getInner());
		// 添加关键词按钮点击事件
		events.add('add', 'click', function (action) {
			getDom(action.data.text).value = addKeywords(action.data.list, getDom(action.data.text).value);
		});
		// 清空关键词按钮点击事件
		events.add('clear', 'click', function (action) {
			getDom(action.data.list).innerHTML = '';
		});
		// 删除关键词事件
		events.add('remove', 'click', function (action) {
			$.remove(action.el);
		});
		// 复选框标签点击事件
		bind('inner', function (event) {
			var node = event.target;
			// 标签下可能有span等元素
			if (node.parentNode && node.parentNode.tagName === 'LABEL') {
				node = node.parentNode;
			}
			if (node.tagName === 'LABEL') {
				event.preventDefault();
				event.stopPropagation();
				if (node.getAttribute('for')) {
					// 有for属性则使用之
					getDom(node.getAttribute('for')).click();
				} else {
					// 默认目标在标签之前（同级）
					node.previousSibling.click();
				}
			}
		});
		// 标签点击事件
		bind('tabHeaders', function (event) {
			var node = event.target, i, len;
			if (node && node.tagName === 'A') {
				node.className = 'current';
				getDom(node.getAttribute('tab')).style.display = '';
				for (i = 0, len = this.childNodes.length; i < len; ++i) {
					if (node !== this.childNodes[i]) {
						this.childNodes[i].className = '';
						getDom(this.childNodes[i].getAttribute('tab')).style.display = 'none';
					}
				}
			}
		});
		// 点击“设置导入/导出”标签时更新内容
		bind('tabHeaderSettings', exportSettings);
		// 更改白名单模式时，自动反选右边栏相关模块
		bind('rightModWhitelist', function () {
			var i, len, item;
			for (i = 0, len = $blocks.length; i < len; ++i) {
				if ($blocks[i][2]) {
					item = getDom('block' + $blocks[i][0]);
					item.checked = !item.checked;
				}
			}
		}, 'change');
		bind('blockAll', function () {
			var i, len, whitelistMode = getDom('rightModWhitelist').checked;
			for (i = 0, len = $blocks.length; i < len; ++i) {
				getDom('block' + $blocks[i][0]).checked = !(whitelistMode && $blocks[i][2]);
			}
		});
		bind('blockInvert', function () {
			var i, len, item;
			for (i = 0, len = $blocks.length; i < len; ++i) {
				item = getDom('block' + $blocks[i][0]);
				item.checked = !item.checked;
			}
		});
		// 对话框按钮点击事件
		bind('import', function () {
			var options = new Options();
			if (options.load(getDom('settingsString').value)) {
				importSettings(options);
				alert('设置导入成功！');
			} else {
				alert('设置导入失败！\n设置信息格式有问题。');
			}
		});
		bind('checkUpdate', checkUpdate);
		bind('OK', function () {
			$options = exportSettings();
			$options.save();
			$filter();
			modifyPage();
			dialog.hide();
		});
		bind('cancel', dialog.hide);
		$.STK.custEvent.add(dialog, 'hide', function () {
			shown = false;
		});
	};

	// 显示设置窗口
	settingsDialog.show = function () {
		if (!dialog) {
			createDialog();
		}
		shown = true;
		importSettings($options);
		dialog.show().setMiddle();
	};
	settingsDialog.isShown = function () {
		return shown;
	};

	return settingsDialog;
}());

function showSettingsBtn() {
	if (!$('wbpShowSettings')) {
		var groups = $.select('#pl_content_homeFeed .nfTagB, #pl_content_hisFeed .nfTagB');
		if (!groups) {return false; }
		var showSettingsTab = document.createElement('li');
		showSettingsTab.id = 'wbpShowSettings';
		showSettingsTab.innerHTML = '<span><em><a href="javascript:void(0)">眼不见心不烦</a></em></span>';
		$.click(showSettingsTab, $settingsDialog.show);
		groups.childNodes[1].appendChild(showSettingsTab);
	}
	return true;
}

var toggleFloatSettingsBtn = (function () {
	var floatBtn = null, lastTime = null, lastTimerID = null;
	// 仿照STK.comp.content.scrollToTop延时100ms显示/隐藏，防止scroll事件调用过于频繁
	function scrollDelayTimer() {
		if ((lastTime != null && (new Date).getTime() - lastTime < 500)) {
			clearTimeout(lastTimerID);
			lastTimerID = null;
		}
		lastTime = (new Date).getTime();
		lastTimerID = setTimeout(function () {
			if (floatBtn) {
				floatBtn.style.visibility = window.scrollY > 0 ? 'visible' : 'hidden';
			}
		}, 100);
	}
	
	return function () {
		if (!$options.floatBtn && floatBtn) {
			window.removeEventListener('scroll', scrollDelayTimer, false);
			$.remove(floatBtn);
			floatBtn = null;
			return true;
		} else if ($options.floatBtn && !floatBtn) {
			var scrollToTop = $('base_scrollToTop');
			if (!scrollToTop) {return false; }
			floatBtn = document.createElement('a');
			floatBtn.innerHTML = '<span style="padding: 0 0 6px;">★</span>';
			floatBtn.className = 'W_gotop';
			floatBtn.href = 'javascript:void(0)';
			floatBtn.title = '眼不见心不烦';
			floatBtn.id = 'wbpFloatBtn';
			floatBtn.style.bottom = '72px';
			$.click(floatBtn, $settingsDialog.show);
			scrollToTop.parentNode.appendChild(floatBtn);			
			window.addEventListener('scroll', scrollDelayTimer, false);
			scrollDelayTimer();
			return true;
		}
		return false;
	};
}());

// 载入设置（只运行一次）
function loadSettings() {
	if (!$.uid || isNaN(Number($.uid))) {
		console.warn('不在作用范围内，脚本未运行！');
		return false;
	}
	$options = new Options();
	if (!$options.load($.get($.uid.toString()))) {
		alert('“眼不见心不烦”设置读取失败！\n设置信息格式有问题。');
	}
	if ($options.autoUpdate) {
		autoUpdate();
	}
	// IFRAME载入不会影响head中的CSS，只添加一次即可
	GM_addStyle('${CSS}');
	modifyPage();
	return true;
}

if (loadSettings()) {
	// 如果第一次运行时就在作用范围内，则直接屏蔽关键词（此时页面已载入完成）；
	// 否则（如“我的评论”）等待切换回首页时再进行屏蔽（由onDOMNodeInsertion处理）
	if ($.scope()) {
		showSettingsBtn();
		//bindTipOnClick();
		$filter();
	}

	// 处理动态载入内容
	document.addEventListener('DOMNodeInserted', onDOMNodeInsertion, false);
	// 处理按键（极简阅读模式）
	document.addEventListener('keyup', onKeyPress, false);
}
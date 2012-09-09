// ==UserScript==
// @name			眼不见心不烦（新浪微博）
// @namespace		http://weibo.com/salviati
// @license			MIT License
// @description		新浪微博（weibo.com）非官方功能增强脚本，具有屏蔽关键词、来源、外部链接，隐藏版面模块等功能
// @features		去除奥运相关模块；增加对新版微博的升级提示；修正包含特殊字符的关键词无法被屏蔽的问题；修正关闭浮动按钮后设置窗口无法关闭的问题
// @version			0.94
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
		['Ads', '#plc_main .W_main_r [id^="ads_"], div[ad-data]'],
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
var $optionData = {
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
};
var $uid, $options = {}, $forwardFeeds = {}, $floodFeeds = {};

var _ = function (s) {
	return document.getElementById(s);
};
var __ = function (s) {
	return document.querySelector(s);
};
// 删除节点
var remove = function (el) {
	el && el.parentNode.removeChild(el);
};
// 绑定事件
var bind = function (el, eventName, handler) {
	el && el.addEventListener(eventName, handler, false);
};
// click事件快捷方式
var click = function (el, handler) {
	bind(el, 'click', handler);
};

function getScope() {
	return 'B_index' === document.body.className ? 1 : 'B_my_profile_other' === document.body.className ? 2 : 0;
}

// Chrome不支持GM_setValue(), GM_getValue()等，需要使用localStorage重新定义
// Firefox 2+, Internet Explorer 8+, Safari 4+和Chrome均支持DOM Storage (HTML5)
if (window.localStorage) {
	var keyRoot = 'weiboPlus.';

	var deleteValue = function (name) {
		localStorage.removeItem(keyRoot + name);
	};

	var getValue = function (name, defval) {
		var val = localStorage.getItem(keyRoot + name);
		return val === null ? defval : val;
	};

	var setValue = function (name, value) {
		localStorage.setItem(keyRoot + name, value);
	};
}

// 对于Chrome和Opera，通过脚本注入获得unsafeWindow
var $window = (!window.chrome) ? unsafeWindow :
		(function () {
			var e = document.createElement('p');
			e.setAttribute('onclick', 'return window;');
			return e.onclick();
		}());

// 搜索指定文本中是否包含列表中的关键词
function searchKeyword(str, key) {
	var text = str.toLowerCase(), keywords = $options[key], keyword, i, len = keywords.length;
	if (str === '' || len === 0) {return ''; }
	for (i = 0; i < len; ++i) {
		keyword = keywords[i];
		if (!keyword) {continue; }
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
}

function filterSource(source, keywords) {
	if (!source) {
		source = '未通过审核应用';
	} else {
		// 过长的应用名称会被压缩，完整名称存放在title属性中
		source = source.title || source.textContent;
	}
	return searchKeyword(source, keywords);
}

var getFeedText = (function () {
	var converter = document.createElement('div');
	return function (content) {
		// 替换表情，去掉标签
		if ($options.filterSmiley) {
			converter.innerHTML = content.innerHTML.replace(/<img[^>]+alt="(\[[^\]">]+\])"[^>]*>/g, '$1')
				.replace(/<\/?[^>]+>/g, '').replace(/[\r\n\t]/g, '').trim();
			// 利用div（未插入文档）进行HTML反转义
			return converter.textContent;
		}
		return content.textContent.replace(/[\r\n\t]/g, '').trim();
	}
}());

function filterFeed(node) {
	if (node.firstChild && node.firstChild.className === 'wbpTip') {
		// 已被灰名单屏蔽过，移除屏蔽提示
		node.removeChild(node.firstChild);
	}
	var scope = getScope(), text = '@', isForward = (node.getAttribute('isforward') === '1'),
		mid = node.getAttribute('mid'),
		content = node.querySelector('dd.content > p[node-type="feed_list_content"]'),
		forwardContent = node.querySelector('dd.content > dl.comment > dt[node-type="feed_list_forwardContent"]'),
		forwardLink = node.querySelector('dd.content > dl.comment > dd.info > a.date'),
		source = node.querySelector('dd.content > p.info > a[target="_blank"]'),
		forwardSource = node.querySelector('dd.content > dl.comment > dd.info > a[target="_blank"]');
	var fmid = isForward ? (forwardLink ? forwardLink.href : null) : null,
		author = (scope === 1) ? content.childNodes[1] : null,
		uid = author ? author.getAttribute('usercard') : null;

	var find = function (array, val) {
		var l = array.length, i;
		for (i = 0; i < l; ++i) {
			if (array[i] === val) {
				return true;
			}
		}
		return false;
	}
	var showFeed = function () {
		node.style.display = '';
		if (!$options.filterPaused) {
			if ($options.filterDupFwd && fmid) {
				if (!$forwardFeeds[fmid]) {
					$forwardFeeds[fmid] = [];
				}
				if (!find($forwardFeeds[fmid], mid)) {
					$forwardFeeds[fmid].push(mid);
				}
			}
			if ($options.filterFlood && uid) {
				if (!$floodFeeds[uid]) {
					$floodFeeds[uid] = [];
				}
				if (!find($floodFeeds[uid], mid)) {
					$floodFeeds[uid].push(mid);
				}
			}
		}
	};
	if (!content) {return false; }
	if (scope === 2) {text = ''; } // 他人主页没有原作者链接
	text += getFeedText(content);
	if (isForward) {
		// 转发内容
		text += '////' + getFeedText(forwardContent);
	}
	console.log(text);
	if ($options.filterPaused || searchKeyword(text, 'whiteKeywords')) { // 白名单检查
		showFeed();
		return false;
	}
	// 屏蔽已删除微博的转发
	if ($options.filterDeleted && isForward && forwardContent.childNodes[1].tagName === 'EM') { // 已删除微博的转发，原文中没有原作者链接
		node.style.display = 'none'; // 直接隐藏，不显示屏蔽提示
		return true;
	}
	// 屏蔽写心情微博
	if ($options.filterFeelings && node.querySelector('dd.content > div.feelingBoxS')) {
		node.style.display = 'none'; // 直接隐藏，不显示屏蔽提示
		return true;
	}
	// 屏蔽指定来源
	if (filterSource(source, 'sourceKeywords') ||
			(isForward && filterSource(forwardSource, 'sourceKeywords'))) {
		node.style.display = 'none'; // 直接隐藏，不显示屏蔽提示
		return true;
	}
	// 反版聊（屏蔽重复转发）
	if ($options.filterDupFwd && fmid && $forwardFeeds[fmid]) {
		if ($forwardFeeds[fmid].length >= Number($options.maxDupFwd) && !find($forwardFeeds[fmid], mid)) {
			console.warn('↑↑↑【被反版聊功能屏蔽】↑↑↑');
			node.style.display = 'none'; // 直接隐藏，不显示屏蔽提示
			return true;
		}
	}
	// 反刷屏（屏蔽同一用户大量发帖）
	if ($options.filterFlood && uid && $floodFeeds[uid]) {
		if ($floodFeeds[uid] >= Number($options.maxFlood) && !find($floodFeeds[uid], mid)) {
			console.warn('↑↑↑【被反刷屏功能屏蔽】↑↑↑');
			node.style.display = 'none'; // 直接隐藏，不显示屏蔽提示
			return true;
		}
	}	
	// 在微博内容中搜索屏蔽关键词
	if (searchKeyword(text, 'blackKeywords')) {
		node.style.display = 'none'; // 直接隐藏，不显示屏蔽提示
		return true;
	}
	// 搜索t.cn短链接
	var links = node.getElementsByTagName('A'), i, len;
	for (i = 0, len = links.length; i < len; ++i) {
		if (links[i].href.substring(0, 12) === 'http://t.cn/' && searchKeyword(links[i].title, 'URLKeywords')) {
			node.style.display = 'none';
			return true;
		}
	}
	// 带提示的屏蔽（灰名单）也算作“显示”，计入反刷屏与反版聊记录
	showFeed();
	var keyword = searchKeyword(text, 'grayKeywords');
	if (!keyword) {
		// 搜索来源灰名单
		var sourceKeyword = filterSource(source, 'sourceGrayKeywords');
		if (!sourceKeyword && isForward) {
			sourceKeyword = filterSource(forwardSource, 'sourceGrayKeywords');
		}
		if (!sourceKeyword) {
			return false;
		}
	}
	// 找到了待隐藏的微博
	var authorClone;
	if (scope === 1) {
		// 添加隐藏提示链接
		authorClone = author.cloneNode(false);
		// 默认的用户链接中多了一个换行符和两个tab
		authorClone.textContent = '@' + author.getAttribute('nick-name');
	}
	var showFeedLink = document.createElement('a');
	showFeedLink.href = 'javascript:void(0)';
	showFeedLink.className = 'wbpTip';
	var keywordLink = document.createElement('a');
	keywordLink.href = 'javascript:void(0)';
	keywordLink.className = 'wbpTipKeyword';
	keywordLink.textContent = keyword || sourceKeyword;
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
	node.insertBefore(showFeedLink, node.firstChild);
	return true;
}

// 屏蔽提示相关事件的冒泡处理
function bindTipOnClick(node) {
	if (!node) { node = __('div.feed_lists'); }
	click(node, function (event) {
		var node = event.target;
		if (node && node.tagName === 'A') {
			if (node.className === 'wbpTipKeyword') {
				$settingsWindow.show();
				event.stopPropagation(); // 防止事件冒泡触发屏蔽提示的onclick事件
			} else if (node.className === 'wbpTip') {
				remove(node);
			}
		}
	});
}

// 处理动态载入内容
function onDOMNodeInsertion(event) {
	if (getScope() === 0) { return false; }
	var node = event.target;
	// console.log(node);
	if (node.tagName === 'DL' && node.classList.contains('feed_list')) {
		// 处理动态载入的微博
		return filterFeed(node);
	} else if (node.tagName === 'DIV' && node.classList.contains('W_loading')) {
		var requestType = node.getAttribute('requesttype');
		// 仅在翻页和切换分组时需要初始化反刷屏/反版聊记录
		// 其它情况（新微博：newFeed，同页接续：lazyload）下不需要
		if (requestType === 'search' || requestType === 'page') {
			$forwardFeeds = {}; $floodFeeds = {};
		}
	} else if (node.tagName === 'DIV' && node.getElementsByClassName('nfTagB').length) {
		// 由于新浪微博使用了BigPipe技术，从"@我的微博"等页面进入时只载入部分页面
		// 需要重新载入设置页面、按钮及刷新微博列表
		showSettingsBtn();
	} else if (node.tagName === 'DIV' && node.classList.contains('feed_lists')) {
 		// 微博列表作为pagelet被一次性载入
		bindTipOnClick(node);
		filterFeeds();
	} else if (node.tagName === 'DIV' && node.classList.contains('send_weibo')) {
		// 清除在发布框中嵌入的默认话题
		clearHotTopic();
	}
	return false;
}

// 自动检查更新
function autoUpdate() {
	// 部分自动更新代码改写自http://loonyone.livejournal.com/
	// 防止重复检查（同时打开多个窗口时），间隔至少两分钟
	var DoS_PREVENTION_TIME = 2 * 60 * 1000;
	var lastAttempt = getValue('lastCheckUpdateAttempt', 0);
	var now = new Date().getTime();

	if (lastAttempt && (now - lastAttempt) < DoS_PREVENTION_TIME) {return; }
	setValue('lastCheckUpdateAttempt', now.toString());

	// 每周检查一次，避免频繁升级
	//var ONE_DAY = 24 * 60 * 60 * 1000;
	var ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
	var lastSuccess = getValue('lastCheckUpdateSuccess', 0);
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
			if (!result.responseText.match(/@version\s+(.*)/)) {return; }
			setValue('lastCheckUpdateSuccess', new Date().getTime().toString());
			var ver = RegExp.$1;
			if (!result.responseText.match(/@revision\s+(\d+)/) || RegExp.$1 <= Number('${REV}')) {
				// 自动检查更新且并无新版本时不必提示
				// 注意不能使用!auto，因为作为click事件处理程序时auto是一个event对象
				if (auto !== true) {alert('“眼不见心不烦”已经是最新版。'); }
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
	var readerModeStyles = _('wbpReaderModeStyles');
	if ($options.readerMode) {
		if (!readerModeStyles) {
			readerModeStyles = document.createElement('style');
			readerModeStyles.type = 'text/css';
			readerModeStyles.id = 'wbpReaderModeStyles';
			document.head.appendChild(readerModeStyles);
		}
		if (_('Box_left')) { // 体验版
			readerModeStyles.innerHTML = '.B_index #Box_left, .B_index #Box_right, .B_index #pl_content_publisherTop, .B_index .global_footer, .B_index #wbim_box { display: none; } .B_index .global_header {top: -35px; } .B_index #Box_center { width: 800px; } .B_index .W_miniblog { background-position-y: -35px; } .B_index .W_main { padding-top: 17px; width: 845px; } .B_index .W_main_bg { background: ' + $options.readerModeBackColor + '; } .B_index .feed_list .repeat .input textarea { width: 688px; } .B_index #base_scrollToTop, .B_index #wbpShowSettingsFloat { margin-left: 424px; }';
		} else { // 传统版
			readerModeStyles.innerHTML = '.B_index #plc_main .W_main_r, .B_index #pl_content_publisherTop, .B_index .global_footer, .B_index #wbim_box { display: none; } .B_index .global_header {top: -35px; } .B_index #plc_main .W_main_c { width: 800px; } .B_index .W_miniblog { background-position-y: -35px; } .B_index #plc_main .custom_content_bg { padding-top: 30px; } .B_index .W_main_narrow { padding-top: 17px; } .B_index .W_main_narrow_bg { background: ' + $options.readerModeBackColor + '; } .B_index .feed_list .repeat .input textarea { width: 628px; }';
		}
	} else if (readerModeStyles) {
		document.head.removeChild(readerModeStyles);
	}
}

// 覆盖当前模板设置
function overrideSkin() {
	var formerStyle = _('custom_style') || _('skin_transformers'),
		skinCSS = _('wbpOverrideSkin');
	if (!formerStyle) { return; }
	if (($uid === $window.$CONFIG.oid && $options.overrideMySkin) ||
		($uid !== $window.$CONFIG.oid && $options.overrideOtherSkin)) {
		if (!skinCSS) {
			skinCSS = document.createElement('link');
			skinCSS.id = 'wbpOverrideSkin';
			skinCSS.type = 'text/css';
			skinCSS.rel = 'stylesheet';
			skinCSS.charset = 'utf-8';
			document.head.insertBefore(skinCSS, formerStyle);
		}
		skinCSS.href = $window.$CONFIG.cssPath + 'skin/' + $options.skinID
			+ '/skin' + ($window.$CONFIG.isnarrow ? '_narrow' : '') + ($window.$CONFIG.lang == "zh-tw" ? '_CHT' : '')
			+ '.css?version=' + $window.$CONFIG.version;
		formerStyle.disabled = true;
	} else if (skinCSS) {
		document.head.removeChild(skinCSS);
		formerStyle.disabled = false;
	}
}

// 检测按键，开关极简阅读模式
function onKeyPress(event) {
	if ($settingsWindow.isShown()) {return; }
	if (getScope() === 1 && event.keyCode === 119) {
		$options.readerMode = !$options.readerMode;
		setValue($uid.toString(), JSON.stringify($options));
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
	var blockStyles = _('wbpBlockStyles');
	if (!blockStyles) {
		blockStyles = document.createElement('style');
		blockStyles.type = 'text/css';
		blockStyles.id = 'wbpBlockStyles';
		document.head.appendChild(blockStyles);
	}
	blockStyles.innerHTML = cssText + '\n';
}

// 根据当前设置屏蔽微博
function filterFeeds() {
	if (!getScope()) { return; }
	// 处理非动态载入内容
	var feeds = document.querySelectorAll('.feed_list'), i, len;
	$forwardFeeds = {}; $floodFeeds = {};
	for (i = 0, len = feeds.length; i < len; ++i) {filterFeed(feeds[i]); }
}

// 清除在发布框中嵌入的默认话题
function clearHotTopic() {
	if ($options.clearHotTopic && getScope() === 1) {
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

// 载入/导入设置更新外部options
// 输入的str为undefined（首次使用时）或string（非首次使用和导入设置时）
function reloadSettings(options, str) {
	var parsedOptions = {}, option;
	// 各类型默认值
	var optionsDefault = {
		keyword : [],
		string : '',
		bool : false,
		array : [],
		object : {},
		internal : null
	};
	if (str) {
		try {
			parsedOptions = JSON.parse(str.replace(/\n/g, ''));
			if (typeof parsedOptions !== 'object') {throw 0; }
		} catch (e) {
			parsedOptions = {};
			str = null; // 出错，最后返回false
		}
	}
	// 填充外部options
	for (option in $optionData) {
		if (parsedOptions[option] !== undefined) {
			// 优先使用成功读取的值
			options[option] = parsedOptions[option];
		} else if ($optionData[option][1] !== undefined) {
			// 使用属性默认值
			options[option] = $optionData[option][1];
		} else {
			// 使用类型默认值
			options[option] = optionsDefault[$optionData[option][0]];
		}
	}
	return (str !== null);
}

var $settingsWindow = (function () {
	var settingsWindow = {}, shown = false;
	var dialog, content;

	var getDom = function (node) {
		return content.getDom(node);
	};
	var bindSTK = function (node, func, event) {
		$window.STK.core.evt.addEvent(content.getDom(node), event || 'click', func);
	};

	// 从显示列表建立关键词数组
	var getKeywords = function (id) {
		if (!getDom(id).hasChildNodes()) {return []; }
		var keywords = getDom(id).childNodes, list = [], i, len;
		for (i = 0, len = keywords.length; i < len; ++i) {
			if (keywords[i].tagName === 'A') { list.push(keywords[i].textContent); }
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
				keywordLink.textContent = keyword;
				getDom(id).appendChild(keywordLink);
			}
		}
		if (malformed.length > 0) {
			alert('下列正则表达式无效：\n' + malformed.join('\n'));
		}
		return malformed.join(' ');
	};

	// 去掉所有内部变量并输出
	var stringifySettings = function (options) {
		var stripped = {}, option;
		for (option in $optionData) {
			if ($optionData[option][0] !== 'internal') {
				stripped[option] = options[option];
			}
		}
		getDom('settingsString').value = JSON.stringify(stripped);
	};

	// 根据当前设置（可能未保存）更新$options
	var exportSettings = function () {
		var options = {}, option;
		for (option in $optionData) {
			switch ($optionData[option][0]) {
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
		stringifySettings(options);
		return options;
	};

	// 更新设置窗口内容，exportSettings()的反过程
	var importSettings = function (options) {
		var option;
		for (option in $optionData) {
			switch ($optionData[option][0]) {
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
		var tipBackColor = getDom('tipBackColor').value;
		var tipTextColor = getDom('tipTextColor').value;
		var tipSample = getDom('tipSample');
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
		stringifySettings(options);
	};

	// 创建设置窗口
	var createDialog = function () {
		dialog = $window.STK.ui.dialog({isHold: true});
		dialog.setTitle('“眼不见心不烦”(v${VER})设置');
		content = $window.STK.module.layer('${HTML}');
		dialog.setContent(content.getOuter());
		// 修改屏蔽提示颜色事件
		bindSTK('tipBackColor', function () {
			getDom('tipSample').style.backgroundColor = this.value;
		}, 'blur');
		bindSTK('tipTextColor', function () {
			getDom('tipSample').style.borderColor = this.value;
			getDom('tipSample').style.color = this.value;
		}, 'blur');
		var events = $window.STK.core.evt.delegatedEvent(content.getInner());
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
			remove(action.el);
		});
		// 复选框标签点击事件
		bindSTK('inner', function (event) {
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
		bindSTK('tabHeaders', function (event) {
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
		bindSTK('tabHeaderSettings', exportSettings);
		bindSTK('rightModWhitelist', function () {
			// 更改白名单模式时，自动反选右边栏相关模块
			var i, len, item;
			for (i = 0, len = $blocks.length; i < len; ++i) {
				if ($blocks[i][2]) {
					item = getDom('block' + $blocks[i][0]);
					item.checked = !item.checked;
				}
			}
		}, 'change');
		bindSTK('blockAll', function () {
			var i, len, whitelistMode = getDom('rightModWhitelist').checked;
			for (i = 0, len = $blocks.length; i < len; ++i) {
				getDom('block' + $blocks[i][0]).checked = !(whitelistMode && $blocks[i][2]);
			}
		});
		bindSTK('blockInvert', function () {
			var i, len, item;
			for (i = 0, len = $blocks.length; i < len; ++i) {
				item = getDom('block' + $blocks[i][0]);
				item.checked = !item.checked;
			}
		});
		// 对话框按钮点击事件
		bindSTK('import', function () {
			var options = {};
			if (reloadSettings(options, getDom('settingsString').value)) {
				importSettings(options);
				alert('设置导入成功！');
			} else {
				alert('设置导入失败！\n设置信息格式有问题。');
			}
		});
		bindSTK('checkUpdate', checkUpdate);
		bindSTK('OK', function () {
			$options = exportSettings();
			setValue($uid.toString(), JSON.stringify($options));
			filterFeeds();
			modifyPage();
			dialog.hide();
		});
		bindSTK('cancel', dialog.hide);
		$window.STK.custEvent.add(dialog, 'hide', function () {
			shown = false;
		});
	};

	// 显示设置窗口
	settingsWindow.show = function () {
		if (!dialog) {
			createDialog();
		}
		shown = true;
		importSettings($options);
		dialog.show().setMiddle();
	};
	settingsWindow.isShown = function () {
		return shown;
	};

	return settingsWindow;
}());

function showSettingsBtn() {
	if (!_('wbpShowSettings')) {
		var groups = __('#pl_content_homeFeed .nfTagB, #pl_content_hisFeed .nfTagB');
		if (!groups) {return false; }
		var showSettingsTab = document.createElement('li');
		showSettingsTab.id = 'wbpShowSettings';
		showSettingsTab.innerHTML = '<span><em><a href="javascript:void(0)">眼不见心不烦</a></em></span>';
		click(showSettingsTab, $settingsWindow.show);
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
			remove(floatBtn);
			floatBtn = null;
			return true;
		} else if ($options.floatBtn && !floatBtn) {
			var scrollToTop = _('base_scrollToTop');
			if (!scrollToTop) {return false; }
			floatBtn = document.createElement('a');
			floatBtn.innerHTML = '<span style="padding: 0 0 6px;">★</span>';
			floatBtn.className = 'W_gotop';
			floatBtn.href = 'javascript:void(0)';
			floatBtn.title = '眼不见心不烦';
			floatBtn.id = 'wbpFloatBtn';
			floatBtn.style.bottom = '72px';
			click(floatBtn, $settingsWindow.show);
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
	if ($window && $window.$CONFIG) {
		$uid = $window.$CONFIG.uid;
	} 
	if (!$uid || isNaN(Number($uid))) {
		console.warn('不在作用范围内，脚本未运行！');
		return false;
	}
	// 如果正在运行新版微博则停止运行并显示提示
	if ($window.$CONFIG.any && $window.$CONFIG.any.indexOf('wvr=5') > -1) {
		if (confirm('您当前使用的“眼不见心不烦”(v${VER})不支持新版微博。\n请使用较高版本(v1.0及以上)的“眼不见心不烦”。\n如果您希望安装新版，请点击“确认”。')) {
			window.open('http://code.google.com/p/weibo-content-filter/downloads/list');
		}
		return false;
	}
	if (!reloadSettings($options, getValue($uid.toString()))) {
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
	if (getScope()) {
		showSettingsBtn();
		bindTipOnClick();
		filterFeeds();
	}

	// 处理动态载入内容
	document.addEventListener('DOMNodeInserted', onDOMNodeInsertion, false);
	// 处理按键（极简阅读模式）
	document.addEventListener('keyup', onKeyPress, false);
}
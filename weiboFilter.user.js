// ==UserScript==
// @name			眼不见心不烦（新浪微博）
// @namespace		http://weibo.com/salviati
// @license			MIT License
// @description		新浪微博（weibo.com）非官方功能增强脚本，具有屏蔽关键词、来源、外部链接，隐藏版面模块等功能
// @features		加入对嵌入式广告的屏蔽；加入对“热评微博”模块（“我的评论”页）的屏蔽；图标屏蔽可以作用于大部分页面；修正在首页点击“首页”时设置按钮消失的问题；修正出现推广微博时屏蔽失效的问题
// @version			0.92b3
// @revision		59
// @author			@富平侯(/salviati)
// @committer		@牛肉火箭(/sunnylost)；@JoyerHuang_悦(/collger)
// @include			http://weibo.com/*
// @include			http://www.weibo.com/*
// @updateURL		https://userscripts.org/scripts/source/114087.meta.js
// @downloadURL		https://userscripts.org/scripts/source/114087.user.js
// ==/UserScript==

// 注意：使用@match替换@include将使GM_xmlhttpRequest()失效
var $blocks = [ // 模块屏蔽设置
		['Topic', '#pl_content_promotetopic, #trustPagelete_zt_hottopic'],
		['InterestUser', '#pl_content_homeInterest, #trustPagelete_recom_interest'],
		['InterestApp', '#pl_content_allInOne, #trustPagelete_recom_allinone'],
		['Notice', '#pl_common_noticeboard, #pl_rightmod_noticeboard'],
		['HelpFeedback', '#pl_common_help, #pl_common_feedback, #pl_rightmod_help, #pl_rightmod_feedback, #pl_rightmod_tipstitle'],
		['Ads', '#plc_main .W_main_r [id^="ads_"], div[ad-data], #ads_bottom_1, dl.feed_list div.olympic_adv_feed'],
		['Footer', 'div.global_footer'],
		['PullyList', '#pl_content_pullylist, #pl_content_biztips'],
		['RecommendedTopic', '#pl_content_publisherTop div[node-type="recommendTopic"]'],
		['Mood', '#pl_content_mood'],
		['Medal', '#pl_content_medal, #pl_rightmod_medal, .declist'],
		['Game', '#pl_leftNav_game'],
		['App', '#pl_leftNav_app'],
		['Tasks', '#pl_content_tasks'],
		['UserGuide', '#pl_guide_oldUser'],
		['Promotion', '#pl_rightmod_promotion, #trustPagelet_ugrowth_invite'],
		['Level', 'span.W_level_ico'],
		['Hello', 'div.wbim_hello'],
		['Balloon', 'div.layer_tips'],
		['TopComment', '#pl_content_commentTopNav'],
		['Member', '#trustPagelet_recom_member'],
		['MemberIcon', '.ico_member:not(.wbpShow), .ico_member_dis:not(.wbpShow)'],
		['VerifyIcon', '.approve:not(.wbpShow), .approve_co:not(.wbpShow)'],
		['DarenIcon', '.ico_club:not(.wbpShow)'],
		['VgirlIcon', '.ico_vlady:not(.wbpShow)'],
		['OlyBoard', '#trustPagelet_yunying_olympic'],
		['OlyPopup', 'div.oly_win'],
		['Oly361', '.ico_oly361:not(.wbpShow)'],
		['OlyMedals', '.ico_olympic_gold:not(.wbpShow), .ico_olympic_silver:not(.wbpShow), .ico_olympic_bronze:not(.wbpShow)'],
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
	filterPaused : ['bool'],
	filterDeleted : ['bool'],
	filterFeelings : ['bool'],
	filterDupFwd : ['bool'],
	maxDupFwd : ['string', 1],
	filterFlood : ['bool'],
	maxFlood : ['string', 5],
	autoUpdate : ['bool', true],
	floatBtn : ['bool', true],
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
		source = source.title || source.innerHTML;
	}
	return searchKeyword(source, keywords);
}

function filterFeed(node) {
	if (node.firstChild && node.firstChild.className === 'wbpTip') {
		// 已被灰名单屏蔽过，移除屏蔽提示
		node.removeChild(node.firstChild);
	}
	var scope = getScope(), text = '@', isForward = (node.getAttribute('isforward') === '1'),
		content = node.querySelector('dd.content > p[node-type="feed_list_content"]'),
		forwardContent = node.querySelector('dd.content > dl.comment > dt[node-type="feed_list_forwardContent"]'),
		forwardLink = node.querySelector('dd.content > dl.comment > dd.info > a.date'),
		source = node.querySelector('dd.content > p.info > a[target="_blank"]'),
		forwardSource = node.querySelector('dd.content > dl.comment > dd.info > a[target="_blank"]');
	var fmid = isForward ? (forwardLink ? forwardLink.href : null) : null,
		author = (scope === 1) ? content.childNodes[1] : null,
		uid = author ? author.getAttribute('usercard') : null;
		
	var showFeed = function () {
		node.style.display = '';
		if (!$options.filterPaused) {
			if ($options.filterDupFwd && fmid) {
				if (!$forwardFeeds[fmid]) {
					$forwardFeeds[fmid] = 1;
				} else {
					++$forwardFeeds[fmid];
				}
			}
			if ($options.filterFlood && uid) {
				if (!$floodFeeds[uid]) {
					$floodFeeds[uid] = 1;
				} else {
					++$floodFeeds[uid];
				}
			}
		}
	};
	if (!content) {return false; }
	if (scope === 2) {text = ''; } // 他人主页没有原作者链接
	text += content.textContent.replace(/[\r\n\t]/g, '').trim();
	if (isForward) {
		// 转发内容
		text += '//' + forwardContent.textContent.replace(/[\r\n\t]/g, '').trim();
	}
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
	if ($options.filterDupFwd && fmid && $forwardFeeds[fmid] >= Number($options.maxDupFwd)) {
		node.style.display = 'none'; // 直接隐藏，不显示屏蔽提示
		return true;
	}
	// 反刷屏（屏蔽同一用户大量发帖）
	if ($options.filterFlood && uid && $floodFeeds[uid] >= Number($options.maxFlood)) {
		node.style.display = 'none'; // 直接隐藏，不显示屏蔽提示
		return true;
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
	node.style.display = '';
	var keyword = searchKeyword(text, 'grayKeywords');
	if (!keyword) {
		// 搜索来源灰名单
		var sourceKeyword = filterSource(source, 'sourceGrayKeywords');
		if (!sourceKeyword && isForward) {
			sourceKeyword = filterSource(forwardSource, 'sourceGrayKeywords');
		}
		if (!sourceKeyword) {
			showFeed();
			return false;
		}
	}
	// 找到了待隐藏的微博
	var authorClone;
	if (scope === 1) {
		// 添加隐藏提示链接
		authorClone = author.cloneNode(false);
		// 默认的用户链接中多了一个换行符和两个tab
		authorClone.innerHTML = '@' + author.innerHTML.slice(3);
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
	var node = event.target;
	if (getScope() === 0) { return false; }
	if (node.tagName === 'DIV' && node.getAttribute('node-type') === 'feed_nav') {
		// 由于新浪微博使用了BigPipe技术，从"@我的微博"等页面进入时只载入部分页面
		// 需要重新载入设置页面、按钮及刷新微博列表
		showSettingsBtn();
	} else if (node.tagName === 'DIV' && node.classList.contains('feed_lists')) {
 		// 微博列表作为pagelet被一次性载入
		bindTipOnClick(node);
		filterFeeds();
	} else if (getScope() && node.tagName === 'DL' && node.classList.contains('feed_list')) {
		// 处理动态载入的微博
		return filterFeed(node);
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
	for (i = 0; i < len; ++i) {
		if ($options.hideBlock[$blocks[i][0]] && $blocks[i][1]) {
			cssText += $blocks[i][1] + ' { display: none !important; }\n';
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

// 根据当前设置修改页面
function modifyPage() {
	// 极简阅读模式
	readerMode();
	// 应用浮动按钮设置
	showSettingsBtn();
	// 屏蔽版面内容
	hideBlocks();
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
		bindSTK('blockAll', function () {
			var i, len;
			for (i = 0, len = $blocks.length; i < len; ++i) {
				getDom('block' + $blocks[i][0]).checked = true;
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
	var floatBtn = _('wbpShowSettingsFloat');
	if (floatBtn) {
		if (!$options.floatBtn) {
			remove(floatBtn);
		}
	} else if ($options.floatBtn) {
		var scrollToTop = _('base_scrollToTop');
		if (!scrollToTop) {return false; }
		var showSettingsFloat = document.createElement('a');
		showSettingsFloat.innerHTML = '<span style="padding: 0 0 6px;">★</span>';
		showSettingsFloat.className = 'W_gotop';
		showSettingsFloat.href = 'javascript:void(0)';
		showSettingsFloat.title = '眼不见心不烦';
		showSettingsFloat.id = 'wbpShowSettingsFloat';
		showSettingsFloat.style.bottom = '72px';
		click(showSettingsFloat, $settingsWindow.show);
		scrollToTop.parentNode.appendChild(showSettingsFloat);
	}
	return true;
}

// 载入设置（只运行一次）
function loadSettings() {
	if ($window && $window.$CONFIG) {
		$uid = $window.$CONFIG.uid;
	} 
	if (!$uid || isNaN(Number($uid))) {
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
		bindTipOnClick();
		filterFeeds();
	}

	// 处理动态载入内容
	document.addEventListener('DOMNodeInserted', onDOMNodeInsertion, false);
	// 处理按键（极简阅读模式）
	document.addEventListener('keyup', onKeyPress, false);
}
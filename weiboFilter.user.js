// ==UserScript==
// @name			眼不见心不烦（新浪微博）
// @namespace		http://weibo.com/salviati
// @license			MIT license
// @description		在新浪微博（weibo.com）用户主页隐藏包含指定关键词的微博。
// @features		使用CSS压缩脚本长度；重新设计了关键词设置界面；脚本可以作用于他人主页
// @version			0.7
// @created			2011.08.15
// @modified		2012.03.12
// @author			富平侯
// @include			http://weibo.com/*
// @include			http://www.weibo.com/*
// ==/UserScript==

var $version = 0.7;
var $uid;
var $blocks;

// Chrome提供的GM_getValue()等有问题（早期版本则不支持），需要使用localStorage重新定义
// Firefox 2+, Internet Explorer 8+, Safari 4+和Chrome均支持DOM Storage (HTML5)
if (window.localStorage) {
	var keyRoot = 'weiboPlus.';
	
	GM_deleteValue = function (name) {
		localStorage.removeItem(keyRoot+name);
	}

	GM_getValue = function (name, defval) {
		var value = localStorage.getItem(keyRoot+name);
		if (value == null)
			return defval;
		return value;
	}

	GM_setValue = function (name, value) {
		localStorage.setItem(keyRoot+name, value);
	}
}

if (!window.chrome)
{
	// 非Chrome浏览器，优先使用unsafeWindow获取全局变量
	// 由于varname中可能包括'.'，因此使用eval()获取变量值
	getGlobalVar = function (varname) { 
		return eval('unsafeWindow.'+varname);
	}
} 
else
{
	// Chrome原生不支持unsafeWindow，脚本运行在沙箱中，因此不能访问全局变量。
	// 但用户脚本与页面共享DOM，所以可以设法将脚本注入host页
	// 详见http://voodooattack.blogspot.com/2010/01/writing-google-chrome-extension-how-to.html
	getGlobalVar = function (varname)
	{
		var elem = document.createElement("script");
		var ret, id = "";
		// 生成脚本元素的随机索引
		while (id.length < 16) id += String.fromCharCode(((!id.length || Math.random() > 0.5) ?
			0x61 + Math.floor(Math.random() * 0x19) : 0x30 + Math.floor(Math.random() * 0x9 )));
		// 生成脚本
		elem.id = id;
		elem.type = "text/javascript";
		elem.innerHTML = "(function(){document.getElementById('"+id+"').innerText="+varname+";})();";
		// 将元素插入DOM（马上执行脚本）
		document.head.appendChild(elem);
		// 获取返回值
		ret = elem.innerText;
		// 移除元素
		document.head.removeChild(elem);
		delete (elem);
		return ret;
	}
}

function hideFeed(node)
{
	if (node.firstChild.tagName == 'A') // 已被屏蔽过
		node.removeChild(node.firstChild);
	var scope = getScope();
	var content;
	switch (scope)
	{
		case 1:
			content = node.childNodes[3];
			break
		case 2:
			content = node.childNodes[1]; // 他人主页的微博没有用户信息
			break
		default:
			return false;
	}
	if (content.tagName!='DD' || !content.classList.contains('content'))
		return false;
	// 在微博内容中搜索屏蔽关键词
	if (searchWhiteKeyword(content.textContent))
	{
		node.style.display = '';
		node.childNodes[1].style.display = '';
		node.childNodes[3].style.display = '';
		node.childNodes[1].style.opacity = 1;
		node.childNodes[3].style.opacity = 1;
		return false;
	}
	if (searchHideKeyword(content.textContent))
	{
		node.style.display = 'none'; // 直接隐藏，不显示屏蔽信息
		return true;
	}
	else 
		node.style.display = '';
	var keyword = searchCensoredKeyword(content.textContent);
	if (keyword == '')
	{
		node.childNodes[1].style.display = '';
		node.childNodes[3].style.display = '';
		node.childNodes[1].style.opacity = 1;
		node.childNodes[3].style.opacity = 1;
		return false;
	}
	if (scope == 1)
	{
		// 2011年11月15日起，新浪微博提供了屏蔽功能，由于屏蔽按钮的存在，微博发布者链接的位置发生了变化
		var author = content.childNodes[3].childNodes[1];
		if (author.tagName != 'A') return false; // 不要屏蔽自己的微博
		node.childNodes[3].style.display = 'none';
		// 添加隐藏提示链接
		authorClone = author.cloneNode(false);
		// 默认的用户链接中多了一个换行符和两个tab
		authorClone.innerHTML = '@'+author.innerHTML.slice(3);
	}
	// 找到了待隐藏的微博
	node.childNodes[1].style.display = 'none';
	var tipBackColor = GM_getValue($uid+'.tipBackColor', '#FFD0D0');
	var tipTextColor = GM_getValue($uid+'.tipTextColor', '#FF8080');
	var showFeed = document.createElement('a');
	showFeed.href = 'javascript:void(0)';
	showFeed.className = 'notes';
	showFeed.style.cssText = 'background-color: '+tipBackColor+'; border-color: '+tipTextColor+'; color: '+tipTextColor+'; margin-bottom: 0px';
	var keywordLink = document.createElement('a');
	keywordLink.href = 'javascript:void(0)';
	keywordLink.innerHTML = keyword;
	keywordLink.addEventListener('click', function (event) {
		showSettingsWindow(event);
		event.stopPropagation(); // 防止事件冒泡触发屏蔽提示的onclick事件
	}, false);
	if (scope == 1)
	{
		showFeed.appendChild(document.createTextNode('本条来自'));
		showFeed.appendChild(authorClone);
		showFeed.appendChild(document.createTextNode('的微博因包含关键词“'));
	}
	else if (scope == 2)
	{
		showFeed.appendChild(document.createTextNode('本条微博因包含关键词“'));
	}
	showFeed.appendChild(keywordLink);
	showFeed.appendChild(document.createTextNode('”而被隐藏，点击显示'));
	showFeed.addEventListener('click', function () 
	{
		this.parentNode.childNodes[2].style.opacity = 1;
		this.parentNode.childNodes[4].style.opacity = 1;
		this.parentNode.removeChild(this);
	}, false);
	showFeed.addEventListener('mouseover', function () 
	{
		this.parentNode.childNodes[2].style.display = '';
		this.parentNode.childNodes[4].style.display = '';
		this.parentNode.childNodes[2].style.opacity = 0.5;
		this.parentNode.childNodes[4].style.opacity = 0.5;
		this.style.cssText = 'background-color: #D0FFD0; border-color: #40D040; color: #40D040;';
	}, false);
	showFeed.addEventListener('mouseout', function () 
	{
		if (this.parentNode == null) return;
		this.parentNode.childNodes[2].style.display = 'none';
		this.parentNode.childNodes[4].style.display = 'none';
		this.parentNode.style.cssText = '';
		this.style.cssText = 'background-color: '+tipBackColor+'; border-color: '+tipTextColor+'; color: '+tipTextColor+'; margin-bottom: 0px';;
	}, false);
	node.insertBefore(showFeed, node.childNodes[0]);
	return true;
}

function searchCensoredKeyword(str)
{
	var keywords = GM_getValue($uid+'.censoredKeywords', '').split(';');
	if (keywords.length == 0)
		return '';
	for (var i in keywords)
	{
		if (keywords[i]!='' && str.indexOf(keywords[i]) > -1)
			return keywords[i];
	}
	return '';
}

function searchHideKeyword(str)
{
	var keywords = GM_getValue($uid+'.hideKeywords', '').split(';');
	if (keywords.length == 0)
		return false;
	for (var i in keywords)
	{
		if (keywords[i]!='' && str.indexOf(keywords[i]) > -1)
			return true;
	}
	return false;
}

function searchWhiteKeyword(str)
{
	var keywords = GM_getValue($uid+'.whiteKeywords', '').split(';');
	if (keywords.length == 0)
		return false;
	for (var i in keywords)
	{
		if (keywords[i]!='' && str.indexOf(keywords[i]) > -1)
			return true;
	}
	return false;
}

function onDOMNodeInsertion(event)
{
	if (getScope() == 0) return false;
	var node = event.target;
	if (node.tagName=='DL' && node.classList.contains('feed_list'))
	{
		// 处理动态载入的微博
		return hideFeed(node);
	}
	if (node.tagName=='DIV' && node.getAttribute('node-type')=='feed_nav')
	{
		// 由于新浪微博使用了BigPipe技术，从"@我的微博"等页面进入时只载入部分页面
		// 需要重新载入设置页面、按钮及刷新微博列表
		if (document.getElementById('wbpSettings') == null)
			loadSettingsWindow();
		showSettingsBtn();
	}
	else if (node.tagName=='DIV' && node.classList.contains('feed_lists'))
	{
		// 微博列表作为pagelet被一次性载入
		applySettings();
	}
	return false;
}

function checkUpdate()
{
    GM_xmlhttpRequest({
		method: 'GET',
		url: 'http://userscripts.org/scripts/source/114087.user.js?source',
		onload: function(result) {
			if (!result.responseText.match(/@version\s+([\d.]+)/)) return;
			ver = RegExp.$1;
			if (parseFloat(ver) <= $version) // 已经是最新版
			{
				alert('脚本已经是最新版。');
				return;
			}
			var features = '';
			if (result.responseText.match(/@features\s+(.*)/)) 
				features = '- '+RegExp.$1.split('；').join('\n- ')+'\n\n';
			// 显示更新提示
			if (confirm('“眼不见心不烦”新版本v'+ver+'可用。\n\n'+features+'如果您希望更新，请点击“确认”打开脚本页面。'))
				window.open("http://userscripts.org/scripts/show/114087")
		}
    });
}

function showSettingsWindow(event)
{
	document.getElementById('wbpSettingsBack').style.cssText = 'background-image: initial; background-attachment: initial; background-origin: initial; background-clip: initial; background-color: black; opacity: 0.3; position: fixed; top: 0px; left: 0px; z-index: 10001; width: '+window.innerWidth+'px; height: '+window.innerHeight+'px;';
	var block = document.getElementById('wbpSettings');
	// Chrome与Firefox的scrollLeft, scrollTop储存于不同位置
	var left = document.body.scrollLeft==0?document.documentElement.scrollLeft:document.body.scrollLeft;
	var top = document.body.scrollTop==0?document.documentElement.scrollTop:document.body.scrollTop;
	block.style.left = (left+event.clientX)+'px';
	block.style.top = (top+event.clientY+10)+'px';
	block.style.display = '';
}

function showSettingsBtn()
{
	// 设置标签已经置入页面
	if (document.getElementById('wbpShowSettings') != null) return;
	var groups = document.getElementsByClassName('nfTagB')[0];
	// Firefox的div#pl_content_homeFeed载入时是空的，此时无法置入页面，稍后由onDOMNodeInsertion()处理
	if (groups === undefined) return;
	var showSettingsTab = document.createElement('li');
	showSettingsTab.innerHTML = '<span><em><a id="wbpShowSettings" href="javascript:void(0)">眼不见心不烦</a></em></span>';
	groups.children[0].appendChild(showSettingsTab);
	document.getElementById('wbpShowSettings').addEventListener('click', showSettingsWindow, false);
}

// 根据当前设置屏蔽/显示所有内容
function applySettings()
{
	// 处理非动态载入内容
	var feeds = document.getElementsByClassName('feed_list');
	for (var i=0; i<feeds.length; ++i) hideFeed(feeds[i]);
	// 屏蔽版面内容
	for (var i in $blocks)
	{
		var isBlocked = (GM_getValue($uid+'.block'+$blocks[i][0], 'false') == 'true');
		if ($blocks[i].length == 2)
		{
			if (typeof $blocks[i][1] == "string")
			{
				var block = document.getElementById($blocks[i][1]);
				if (block != null) block.style.display = isBlocked?'none':'';
			} else { // 数组
				for (var j in $blocks[i][1]) 
				{
					var block = document.getElementById($blocks[i][1][j]);
					if (block != null) block.style.display = isBlocked?'none':'';
				}
			}
			continue;
		}
		// 单独处理广告
		if ($blocks[i][0] == 'Ads')
		{
			var sideBar = document.getElementsByClassName('W_main_r')[0];
			for (var j in sideBar.children)
			{
				var elem = sideBar.children[j];
				if (elem.tagName=='DIV' && (elem.id.indexOf('ads_')==0 || elem.hasAttribute('ad-data')))
					elem.style.display = isBlocked?'none':'';
			}
		}
		// 单独处理推荐话题
		else if ($blocks[i][0] == 'RecommendedTopic')
		{
			var recommendedTopic = document.getElementsByClassName('key')[0];
			if (recommendedTopic!=null && recommendedTopic.parentNode.classList.contains('send_weibo'))
			{
				recommendedTopic.style.display = isBlocked?'none':'';
			}
		}
		// 单独处理勋章
		else if ($blocks[i][0] == 'Medal')
		{
			// 传统版
			var medalList = document.getElementById('pl_content_medal');
			if (medalList != null)
				medalList.style.display = isBlocked?'none':'';
			else // 体验版
			{
				var medalList = document.getElementsByClassName('declist')[0];
				if (medalList != null) medalList.style.display = isBlocked?'none':'';
			}
		}
	}
}

function getKeywords(id)
{
	if (!document.getElementById(id).hasChildNodes())
		return '';
	var keywords = document.getElementById(id).childNodes;
	var list = new Array();
	for (i=0; i<keywords.length; i++)
	{
		if (keywords[i].tagName == 'A')
			list.push(keywords[i].innerHTML);
	}
	return list.join(';');
}

function addKeywords(id, str)
{
	var keywords = str.split(';');
	if (keywords.length == 0) return;
	for (var i in keywords)
	{
		if (keywords[i] != '')
		{
			var keywordLink = document.createElement('a');
			keywordLink.title = '删除关键词';
			keywordLink.href = 'javascript:void(0)';
			keywordLink.addEventListener('click', function () 
			{
				this.parentNode.removeChild(this);
			}, false);
			keywordLink.innerHTML = keywords[i];
			document.getElementById(id).appendChild(keywordLink);
		}
	}
}

function reloadSettings()
{
	document.getElementById('wbpWhiteKeywordList').innerHTML = '';
	document.getElementById('wbpHideKeywordList').innerHTML = '';
	document.getElementById('wbpCensoredKeywordList').innerHTML = '';
	addKeywords('wbpWhiteKeywordList', GM_getValue($uid+'.whiteKeywords', ''));
	addKeywords('wbpHideKeywordList', GM_getValue($uid+'.hideKeywords', ''));
	addKeywords('wbpCensoredKeywordList', GM_getValue($uid+'.censoredKeywords', ''));
	document.getElementById('wbpWhiteKeywords').value = '';
	document.getElementById('wbpHideKeywords').value = '';
	document.getElementById('wbpCensoredKeywords').value = '';
	var tipBackColor = GM_getValue($uid+'.tipBackColor', '#FFD0D0');
	var tipTextColor = GM_getValue($uid+'.tipTextColor', '#FF8080');
	document.getElementById('wbpTipBackColor').value = tipBackColor;
	document.getElementById('wbpTipTextColor').value = tipTextColor;
	var tipSample = document.getElementById('wbpTipSample');
	tipSample.style.backgroundColor = tipBackColor;
	tipSample.style.borderColor = tipTextColor;
	tipSample.style.color = tipTextColor;
	for (var i in $blocks)
	{
		if (GM_getValue($uid+'.block'+$blocks[i][0], 'false') == 'true')
			document.getElementById('wbpBlock'+$blocks[i][0]).checked = true;
	}
}

function loadSettingsWindow()
{
	$uid = getGlobalVar('$CONFIG.uid');
	
	// 加入选项设置
	GM_addStyle('#settings.css#');
	var keywordBack = document.createElement('div');
	keywordBack.id = 'wbpSettingsBack';
	keywordBack.style.display = 'none';
	var keywordBlock = document.createElement('div');
	keywordBlock.className = 'W_layer';
	keywordBlock.id = 'wbpSettings';
	keywordBlock.style.cssText = 'width: 500px; margin-left: -250px; z-index: 10001; position: absolute; display: none;';
	keywordBlock.innerHTML = '#settings.html#';
	document.body.appendChild(keywordBack);
	document.body.appendChild(keywordBlock);
	document.getElementById('wbpSettingsTitle').innerHTML = '“眼不见心不烦”(v'+$version+')设置';
	// 修改屏蔽提示颜色事件
	document.getElementById('wbpTipBackColor').addEventListener('blur', function () 
	{
		document.getElementById('wbpTipSample').style.backgroundColor = this.value;
	}, false);
	document.getElementById('wbpTipTextColor').addEventListener('blur', function () 
	{
		document.getElementById('wbpTipSample').style.borderColor = this.value;
		document.getElementById('wbpTipSample').style.color = this.value;
	}, false);
	// 添加关键词按钮点击事件
	document.getElementById('wbpAddWhiteKeyword').addEventListener('click', function () 
	{
		addKeywords('wbpWhiteKeywordList', document.getElementById('wbpWhiteKeywords').value);
		document.getElementById('wbpWhiteKeywords').value = '';
	}, false);
	document.getElementById('wbpAddHideKeyword').addEventListener('click', function () 
	{
		addKeywords('wbpHideKeywordList', document.getElementById('wbpHideKeywords').value);
		document.getElementById('wbpHideKeywords').value = '';
	}, false);
	document.getElementById('wbpAddCensoredKeyword').addEventListener('click', function () 
	{
		addKeywords('wbpCensoredKeywordList', document.getElementById('wbpCensoredKeywords').value);
		document.getElementById('wbpCensoredKeywords').value = '';
	}, false);
	// 标签点击事件
	for (var i=1; i<=3; i++)
	{
		document.getElementById('wbpTabHeader'+i).setAttribute('order', i);
		document.getElementById('wbpTabHeader'+i).addEventListener('click', function () {
			i = this.getAttribute('order');
			for (var j=1; j<=3; j++)
			{
				if (i == j)
				{
					document.getElementById('wbpTabHeader'+j).className = 'current W_texta';
					document.getElementById('wbpTab'+j).style.display = '';
				} else {
					document.getElementById('wbpTabHeader'+j).className = '';
					document.getElementById('wbpTab'+j).style.display = 'none';
				}
			}
		}, false);
	}
	// 模块屏蔽设置
	$blocks = Array(
		Array('Fun', 'pl_common_fun'),
		Array('Topic', 'pl_content_promotetopic'),
		Array('InterestUser', 'pl_content_homeInterest'),
		Array('PopularUser', 'pl_relation_recommendPopularUsers'),
		// 2012年2月27日起，新浪微博“可能感兴趣的微群”模块ID发生变化
		Array('InterestGroup', 'pl_common_thirdmodule_1005'),
		Array('InterestApp', 'pl_content_allInOne'),
		Array('Notice', 'pl_common_noticeboard'),
		Array('HelpFeedback', Array('pl_common_help', 'pl_common_feedback')),
		Array('Ads'),
		Array('BottomAds', 'ads_bottom_1'),
		Array('PullyList', 'pl_content_pullylist'),
		Array('RecommendedTopic'),
		Array('Mood', 'pl_content_mood'),
		Array('Medal'),
		Array('Game', 'pl_leftNav_game'),
		Array('App', 'pl_leftNav_app'),
		Array('Tasks', 'pl_content_tasks')
		);
	document.getElementById('wbpBlockAll').addEventListener('click', function () 
	{
		for (var i in $blocks)
		{
			document.getElementById('wbpBlock'+$blocks[i][0]).checked = true;
		}
	}, false);
	document.getElementById('wbpBlockInvert').addEventListener('click', function () 
	{
		for (var i in $blocks)
		{
			document.getElementById('wbpBlock'+$blocks[i][0]).checked = !document.getElementById('wbpBlock'+$blocks[i][0]).checked;
		}
	}, false);
	// 对话框按钮点击事件
	document.getElementById('wbpOKBtn').addEventListener('click', function () 
	{
		GM_setValue($uid+'.whiteKeywords', getKeywords('wbpWhiteKeywordList'));
		GM_setValue($uid+'.censoredKeywords', getKeywords('wbpCensoredKeywordList'));
		GM_setValue($uid+'.hideKeywords', getKeywords('wbpHideKeywordList'));
		GM_setValue($uid+'.tipBackColor', document.getElementById('wbpTipBackColor').value);
		GM_setValue($uid+'.tipTextColor', document.getElementById('wbpTipTextColor').value);
		for (var i in $blocks)
		{
			GM_setValue($uid+'.block'+$blocks[i][0], document.getElementById('wbpBlock'+$blocks[i][0]).checked);
		}
		document.getElementById('wbpSettingsBack').style.display = 'none';
		document.getElementById('wbpSettings').style.display = 'none';
		applySettings();
	}, false);
	document.getElementById('wbpCancelBtn').addEventListener('click', function ()
	{
		reloadSettings();
		document.getElementById('wbpSettingsBack').style.display = 'none';
		document.getElementById('wbpSettings').style.display = 'none';		
	}, false);
	document.getElementById('wbpCloseBtn').addEventListener('click', function ()
	{
		reloadSettings();
		document.getElementById('wbpSettingsBack').style.display = 'none';
		document.getElementById('wbpSettings').style.display = 'none';		
	}, false);

	reloadSettings();
	document.getElementById('wbpCheckUpdate').addEventListener('click', checkUpdate, false);
}

function getScope()
{
	if (document.body.className == 'B_index') // 个人主页
		return 1;
	else if (document.body.className == 'B_my_profile_other') // 他人主页
		return 2;
	return 0;
}

// 仅在个人首页与他人页面生效
if (getScope() > 0)
{
	loadSettingsWindow();
	showSettingsBtn();
	applySettings();
}

// 处理动态载入内容
document.addEventListener('DOMNodeInserted', onDOMNodeInsertion, false);
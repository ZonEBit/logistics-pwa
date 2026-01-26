/**
 * 解析物流短信
 * @param {string} text - 短信文本内容
 * @returns {object} - 包含 code, courier, location, rawText 的对象
 */
function parseLogisticsMessage(text) {
    // 0. 尝试特定格式解析
    // 格式：【申通快递】请凭12-2-1203到紫桂苑东区二楼取件，地址：紫桂苑东区二楼
    const specialResult = parseSpecialFormat(text);
    if (specialResult) {
        return specialResult;
    }

    const result = {
        code: '',
        courier: '',
        location: '',
        rawText: text
    };

    // 1. 匹配快递公司
    // 优先匹配“您的XX快递”或“XX包裹”中的公司名，这通常比开头的【签名】更准确
    const courierKeywords = '圆通|中通|申通|韵达|顺丰|京东|极兔|菜鸟|丰巢|德邦|邮政|EMS|丹鸟|天猫|申通';
    
    // 匹配模式：优先寻找“您的”或者紧跟在“包裹”前的公司名
    const patterns = [
        new RegExp(`您的(${courierKeywords})(快递|速运|包裹|驿站|超市)?`, 'i'),
        new RegExp(`(${courierKeywords})(快递|速运|包裹)`, 'i'),
        new RegExp(`【(${courierKeywords})(?:快递|速运|包裹|驿站|超市)?】`, 'i'), // 只有在没有“您的”时才考虑签名
        new RegExp(`(${courierKeywords})(快递|速运|包裹|驿站|超市)?`, 'i')
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            // 如果匹配到了“您的”，去掉它
            result.courier = match[0].replace(/^您的/, '').replace(/[【】]/g, '');
            break;
        }
    }

    // 2. 匹配取件码 (4-10位数字或字母组合，支持中划线)
    const codePatterns = [
        /(?:取件码|凭|码|验证码|密码|取件)[:：\s]?([A-Z0-9-]{4,12})/i,
        /([A-Z0-9]{1,3}-[A-Z0-9]{1,3}-[A-Z0-9]{4,6})/i,
        /([A-Z0-9]{4,10})/i
    ];

    for (const pattern of codePatterns) {
        const match = text.match(pattern);
        if (match) {
            let code = match[1] || match[0];
            if (!/[\u4e00-\u9fa5]/.test(code)) {
                result.code = code.trim();
                break;
            }
        }
    }

    // 3. 匹配位置
    const locationPatterns = [
        /(?:已到|存入|在|存放在|送至|放置在|到达)\s?([^，。！!？?\s]{4,})[，。！!？? ]?(?:请|取件码|凭|地址)/,
        /(?:已到|存入|在|存放在|送至|放置在|到达)\s?([^，。！!？?\s]{4,})/
    ];

    for (const pattern of locationPatterns) {
        const match = text.match(pattern);
        if (match) {
            let loc = match[1].trim();
            // 进一步清理位置，如果位置开头包含“到达”等词，截掉
            loc = loc.replace(/^(?:到达|在)/, '');
            result.location = loc;
            break;
        }
    }

    // 针对特定格式的优化：如果位置中包含了取件码相关词汇，截断它
    if (result.location) {
        result.location = result.location.split(/(?:取件码|凭|请凭|请于)/)[0].replace(/[，。]$/, '').trim();
    }

    return result;
}

/**
 * 解析特定格式：【快递】请凭Code到Location取件，地址：Location
 */
function parseSpecialFormat(text) {
    const result = {
        code: '',
        courier: '',
        location: '',
        rawText: text
    };

    // 1. 提取快递公司 【...】
    const courierMatch = text.match(/【([^】]+)】/);
    if (courierMatch) {
        result.courier = courierMatch[1].trim();
    }

    // 2. 提取取件码 请凭...
    // 假设取件码由数字、字母、横线组成
    const codeMatch = text.match(/请凭\s*([A-Za-z0-9-]+)/);
    if (codeMatch) {
        result.code = codeMatch[1].trim();
    }

    // 3. 提取地址 地址：...
    const locationMatch = text.match(/地址[:：]\s*(.*)$/);
    if (locationMatch) {
        result.location = locationMatch[1].trim();
    }

    // 只有当三个要素都提取到才返回，否则返回 null 以便回退到通用解析
    if (result.courier && result.code && result.location) {
        return result;
    }
    
    return null;
}

// 如果在 Node 环境下，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseLogisticsMessage };
}

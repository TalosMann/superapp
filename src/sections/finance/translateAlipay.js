/**
 * translateAlipay.js — Best-effort Chinese → English translation for Alipay
 * transaction descriptions.
 *
 * This file is the OFFLINE layer — a deterministic, no-network translator
 * built from real patterns observed in actual Alipay cashbook exports. It
 * always runs, with no opt-in needed, and is tried first regardless of
 * whether the (separate, opt-in) translateApi.js layer is enabled:
 *
 *   1. PATTERN_RULES — regex rules for templated, machine-generated note
 *      formats (campus store purchases, Meituan bike rides, subway trips, QR
 *      payments, refunds, phone bills...). These recur every month, so
 *      coverage here keeps working on future imports, not just this one.
 *   2. BRAND_DICTIONARY — substring replacement for ~45 recognizable chain
 *      names (KFC, Starbucks, Walmart, DiDi, etc.).
 *   3. EXACT_DICTIONARY — full-string matches for one-off text (long
 *      e-commerce product titles) that won't recur in the same form, so
 *      pattern/brand matching can't help — translated by hand from the
 *      specific file this was built against.
 *
 * Anything none of these three layers recognize is left untouched in the
 * original Chinese, rather than guessed at — a wrong translation is worse
 * than no translation in a financial record. The opt-in API layer
 * (translateApi.js) picks up from here for anything still untranslated, if
 * the person has enabled it; this file has no network dependency itself and
 * works the same with or without that layer turned on.
 */

import { translateBatch } from './translateApi.js'

// ── 1. Pattern rules (regex → translator function) ─────────────────────────
// Tried in order, most specific first. Each entry: [regex, fn(match) => string]

const PATTERN_RULES = [
  // "苏州太仓西浦大学店当面付商品交易:26061900950119"
  [/^苏州太仓西浦大学店当面付商品交易[:：]\d+$/, () => 'XJTLU Campus Store Purchase'],

  // "美团订单-美团骑行-单车-骑行费-2026-06-14 13:26:32"
  [/^美团订单-美团骑行-单车-骑行费-(.+)$/, (m) => `Meituan Bike Ride – ${m[1]}`],

  // "地铁-落星桥-2026-06-14 20:10:55-苏州火车站-2026-06-14 20:35:46"
  [/^(上海)?地铁-(.+?)-[\d: -]+-(.+?)-[\d: -]+$/, (m) =>
    `${m[1] ? 'Shanghai ' : ''}Metro: ${translateStation(m[2])} → ${translateStation(m[3])}`],

  // "扫收钱码付款-给X" / "扫经营码付款-给X"
  [/^扫(收钱码|经营码)付款-给(.+)$/, (m) => `QR Payment to ${translateBrand(m[2])}`],

  // "X外卖订单" (delivery order, brand name not already followed by -美团App-)
  [/^(.+?)外卖订单$/, (m) => `${translateBrand(m[1])} (Delivery Order)`],

  // "收款-向X收款" (collecting FROM X → income)
  [/^收款-向(.+?)收款$/, (m) => `Payment from ${m[1]}`],
  // "收款-X" (a collection request paid → expense)
  [/^收款-(.+)$/, (m) => `Payment to ${m[1]}`],

  // "退款-X"
  [/^退款-(.+)$/, (m) => `Refund: ${translateBrand(m[1])}`],

  // "为130****6257交费300.00元"
  [/^为(\d{3}\*+\d{4})交费([\d.]+)元$/, (m) => `Phone/Utility Payment ¥${m[2]} (${m[1]})`],

  // "X-美团App-订单号..." (Meituan delivery order)
  [/^(.+?)-美团App-.+$/, (m) => `${translateBrand(m[1])} (Meituan Delivery)`],

  // "自动售货机自选商品_消费时间：..."
  [/^自动售货机自选商品_消费时间[:：].+$/, () => 'Vending Machine Purchase'],

  // "商户单号X" (bare merchant order number, no name)
  [/^商户单号(.+)$/, (m) => `Merchant Payment (Order #${m[1]})`],

  // "滴滴快车打车-陈师傅-06月03日行程"
  [/^滴滴快车打车-(.+?)-(\d+)月(\d+)日行程$/, (m) => `DiDi Express – Driver ${m[1]} – ${m[2]}/${m[3]}`],
]

// ── Place names (subway stations etc.) — small, separate from brands ───────

const PLACE_NAMES = {
  '苏州火车站': 'Suzhou Railway Station',
  '上海火车站': 'Shanghai Railway Station',
  '徐家汇': 'Xujiahui',
  '老西门': 'Laoximen',
  '九亭': 'Jiuting',
  '落星桥': 'Luoxingqiao',
  '乐桥': 'Leqiao',
  '延长路': 'Yanchang Road',
}

function translateStation(name) {
  return PLACE_NAMES[name] || name
}

// ── 2. Brand / chain dictionary (substring replace) ─────────────────────────

const BRAND_DICTIONARY = {
  '肯德基（林泉KPRO店）': 'KFC (Linquan KPRO)',
  '肯德基': 'KFC',
  '麦当劳': "McDonald's",
  '星巴克苏州文缘公寓店': 'Starbucks (Suzhou Wenyuan)',
  '星巴克臻选': 'Starbucks Reserve',
  '星巴克': 'Starbucks',
  '上海星巴克咖啡经营有限公司': 'Starbucks (Shanghai Corp.)',
  '必胜客': 'Pizza Hut',
  '沃尔玛购物广场太仓府南街店': 'Walmart (Taicang Funan St.)',
  '苏州全家便利店': 'FamilyMart (Suzhou)',
  '上海全家便利店': 'FamilyMart (Shanghai)',
  '全家便利店（胶州二店）': 'FamilyMart (Jiaozhou Branch #2)',
  '全家便利店（太仓大道店）': 'FamilyMart (Taicang Boulevard)',
  '全家便利店': 'FamilyMart',
  '罗森': 'Lawson',
  '85度C（太仓万达二店）': '85°C Bakery Café (Taicang Wanda)',
  'CHAGEE霸王茶姬': 'CHAGEE',
  '茉莉奶白（苏州太仓西交利物浦大学店）': 'Molly Tea (XJTLU)',
  '茉莉奶白': 'Molly Tea',
  '西树泡芙': 'Sees Puff (dessert)',
  '品沐食集': 'Pinmu Food Court',
  '巴比馒头': 'Babi Buns',
  '锦穆蘭兰州牛肉面': 'Lanzhou Beef Noodles',
  '邮优便利超市': 'Youyou Convenience Store',
  '诗驿便利店': 'Shiyi Convenience Store',
  '必顺便利店': 'Bishun Convenience Store',
  '快进商店': 'Kuaijin Store',
  '旺角便利店': 'Wongkok Convenience Store',
  '世纪华联生活超市': 'Century Lianhua Supermarket',
  '苏州市太仓市好幸福零食店': 'Haoxingfu Snack Shop (Taicang)',
  '怪兽充电宝': 'Energy Monster (power bank rental)',
  '企鹅共享': 'Penguin Share (power bank rental)',
  '劲电猫共享充电宝': 'Jindian Cat (power bank rental)',
  '小电充电': 'Xiaodian Charging (power bank rental)',
  '美团充电，美好生活不断电': 'Meituan Power Bank Rental',
  '高德打车订单': 'Amap Taxi',
  '哈啰出行车费': 'Hello Ride Fare',
  '哈啰顺风车': 'Hello Carpool',
  '小拉出行预付车费': 'Xiaola Ride-hailing (prepaid)',
  '滴滴出行': 'DiDi',
  'BK&PENG冠军面包': 'BK&PENG Champion Bakery',
  'AI Milk Printx1': 'AI Milk Print (drink customization)',
  '苏州市鸣润生活服务有限公司': 'Mingrun Life Services Co. (Suzhou)',
  '拳击猫·精酿啤酒餐厅（月光码头店）': 'Boxing Cat Craft Beer (Moonlight Dock)',
  '凡可（上海）商贸有限公司': 'Fanke Trading Co. (Shanghai)',
  '南洋大师傅': 'Nanyang Chef',
  '太仓市高新区谷嘟谷嘟贸易商行': 'Gudugudu Trading (Taicang)',
  '太犇牛手作茶铺(上海迪美广场店)': 'Taiben Handmade Tea (Shanghai Dimei Plaza)',
  '汇购猫（黄埔中心店）': 'Huigoumao (Huangpu Center)',
  '昔木生日蛋糕(上海店)': 'Ximu Birthday Cakes (Shanghai)',
  '徐州烤肉筋·卷饼（太仓店）': 'Xuzhou Grilled Meat Wrap (Taicang)',
  '塔斯汀·中国汉堡(太仓陆渡市场店)': 'Tastien Chinese Burger (Taicang Ludu Market)',
  '塔斯汀·中国汉堡(万达金街店)': 'Tastien Chinese Burger (Wanda Jinjie)',
  '牛约堡-手作牛肉汉堡(太仓万达店)': 'Niu Yueh Bao Handmade Beef Burger (Taicang Wanda)',
  '汉堡王（苏州狮山梦之城31458店）': 'Burger King (Suzhou Shishan Dream City)',
  '正新鸡排（太仓板桥店）': 'Zhengxin Chicken Cutlet (Taicang Banqiao)',
  '苏州工业园区张美娟餐饮店(个体工商户)': 'Zhang Meijuan Restaurant (Suzhou SIP)',
  '乐鑫餐饮': 'Lexin Restaurant',
  '科桥餐饮': 'Keqiao Restaurant',
  '泸溪河江苏食品销售有限公司': 'Luxihe Food Sales (Jiangsu)',
  'Café Mersey店内购物': 'Café Mersey (in-store purchase)',
  '文星店': 'Wenxing Branch',
  '月亮湾路店（苏州）': 'Yueliangwan Road Branch (Suzhou)',
  '便利店消费': 'Convenience Store Purchase',
  '美团': 'Meituan',
  '美团收银909700213158534606': 'Meituan Checkout',
  '京东便利店（太仓万达店）': 'JD Convenience Store (Taicang Wanda)',
  '乐购汪生活超市（静安寺店）': 'Lego Wang Supermarket (Jing\'an Temple)',
  '新疆正宗羊肉烧烤': 'Xinjiang BBQ Restaurant',
  '爱耳可视采耳': "Ai'er Visual Ear Cleaning",
}

function translateBrand(text) {
  if (BRAND_DICTIONARY[text]) return BRAND_DICTIONARY[text]
  for (const [zh, en] of Object.entries(BRAND_DICTIONARY)) {
    if (text.includes(zh)) return text.replace(zh, en)
  }
  return text
}

// ── 3. Exact one-off translations (won't recur in this exact form) ─────────

const EXACT_DICTIONARY = {
  '余额提现': 'Balance Withdrawal',
  '余额充值': 'Balance Top-up',
  '网易云音乐-会员自动续费': 'NetEase Music – Membership Auto-renewal',
  '上海市e桶影院足道瞿溪店': 'e-Tong Cinema & Foot Spa (Qixi)',
  '修脚+泡脚30分钟': 'Pedicure + Foot Soak (30 min)',
  '刮痧拔罐套餐30分钟': 'Gua Sha + Cupping Package (30 min)',
  '上海单次精致扦脚无按摩': 'Pedicure, No Massage (Shanghai)',
  '上海华铁旅客服务有限公司': 'Shanghai Huatie Passenger Services',
  '江苏省公安厅出入境管理局，外国人居留许可': 'Jiangsu Immigration Bureau – Foreigner Residence Permit',
  '孔夫子旧书网29379341654920001': 'Kongfuzi Used Books – Order',
  '卡滋贝诺': 'Carls Berno',
  '柳吴伟欧美复古铆钉弹力松紧腰带女配裙子西装外套百搭腰封装饰宽':
    'Vintage Studded Stretch Belt (Women\'s)',
  '2025秋冬新款男式皮马甲修身多拉链翻领短款皮马甲外套5641特P80':
    "Men's Slim Leather Vest, Multi-zip (2025 A/W)",
  'KELME卡尔美足球儿童小学生中考专用4号5号3号四幼儿成人专业比赛 等多件':
    'KELME Football Boots (Kids/Adult)',
  'YEKEHAN-Afro Comb Plastic HAIR comb非洲卷发梳塑料扁梳插发梳': 'YEKEHAN Afro Hair Comb',
  '欧美明星周边ladygaga等身人形立牌kt板定制演唱会粉丝应援礼物':
    'Lady Gaga Life-size Standee (Fan Merch)',
  '悦居Hostel青年旅社（中山医院店）阳光悦享男生十二人间':
    'Yueju Hostel – 12-bed Male Dorm (Zhongshan Hospital)',
  '零度可口可乐塑料500毫升x1': 'Coca-Cola Zero 500ml x1',
  '外星人电解质水青柠味低糖600ml * 1': "Alien Electrolyte Water, Lime, Low Sugar 600ml x1",
  '外星人电解质水西柚味低糖600ml * 1': 'Alien Electrolyte Water, Grapefruit, Low Sugar 600ml x1',
  '外星人维B水低糖阳光青提口味500ml * 1': 'Alien Vitamin B Water, Green Grape, Low Sugar 500ml x1',
  '维达抽纸120抽 * 1;雪碧清爽柠檬味汽水细罐330ml': 'Vinda Tissues 120ct + Sprite Lemon 330ml can',
  '维达抽纸120抽 * 1;可口可乐零度摩登罐330ml *': 'Vinda Tissues 120ct + Coke Zero 330ml can',
  '抖音电商-订单编号6926682910418632245': 'Douyin E-commerce – Order',
  '抖音电商-订单编号6926702003164577333': 'Douyin E-commerce – Order',
  '全麦面包0脂控无糖精黑麦代餐粗粮早餐营养低脂零食品欧包减吐司':
    'Whole-grain Rye Bread (low-fat, sugar-free)',
  '假发防滑带发网固定神器cos工具发套绷带硅胶防掉束发带压发条贴':
    'Wig Grip Band (cosplay accessory)',
  '复古摇滚迈克尔杰克逊Michael同款假发舞台年会派对表演装扮道具':
    'Michael Jackson-style Wig (costume)',
  '仿真婴儿超大50洋娃娃女孩玩具宝宝玩偶软胶橡胶可洗澡公仔布娃娃':
    'Realistic Baby Doll Toy, 50cm',
  '男士剃须后水细腻修复护理爽肤水喷雾桉树薄荷清爽修面须后水保湿':
    "Men's Aftershave Toner Spray (eucalyptus mint)",
  'MELAO胡须油pre shave oil柔肤滋养胡须跨境刮胡子润滑防刮伤剃':
    'MELAO Pre-Shave Beard Oil',
  '雅鹿阿罗裤内裤男士宽松男款冰丝裸睡无束缚平角四角睡裤夏季薄款':
    "Men's Ice-Silk Sleep Boxers (summer)",
  '春秋季机车无袖马甲外套韩版修身潮流休闲春季背心西服pu皮马夹男':
    "Men's Sleeveless PU Leather Vest (Korean style)",
  '布洛克皮鞋男士春季商务休闲正装增高英伦风德比鞋西装结婚新郎鞋':
    "Men's Brogue Derby Shoes",
  '高级皮鞋油鞋油皮鞋通用黑色无色保养上光绵羊真皮擦鞋护理神器':
    'Leather Shoe Polish/Care Kit',
  '欧美表演亮片手套成人舞蹈舞台夜场跳舞专用迈克尔杰克逊手套时尚':
    'Sequin Performance Gloves (MJ-style)',
  '本命年红色尖领衬衫男高级感韩版潮流ins痞帅宽松设计感工装衬衣':
    "Men's Red Pointed-collar Shirt (Korean style)",
  'The English Roses 英格兰玫瑰/MADONNA/PUFFIN': 'The English Roses (book) / Madonna / Puffin',
  'Cantu，Shea Butter，Coconut Curling Cream乳木果油椰子卷发霜CGM':
    'Cantu Shea Butter Coconut Curling Cream',
  '走珠液香体露止汗露腋下除异味干爽香体滚珠留香男女士专用':
    'Roll-on Antiperspirant Deodorant',
  '6201300860073545': 'Bank Card Payment (…3545)',
  '6201300110027505': 'Bank Card Payment (…7505)',
  '6201300490001534': 'Bank Card Payment (…1534)',
  'BUS-000143-17:55': 'Bus Fare (Route 000143, 17:55)',
  '苏州-太仓万达刷卡付': 'Card Payment – Taicang Wanda (Suzhou)',
  '鲁班路五店': 'Luban Road Branch #5',
  'C罗刺客战狼足球鞋男女成人TF碎钉学生大码47小码儿童比赛训练鞋': 'Football Boots (Adult/Kids, TF studs)',
  'Cozy Coffee 浇个朋友': 'Cozy Coffee – Refer a Friend Voucher',
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Best-effort translation of a single Alipay note/description into English.
 * Tries pattern rules first (most specific, and the ones that keep working
 * on future imports), then exact-match dictionary, then brand substring
 * matching. Falls back to the original text untouched if nothing matches —
 * never fabricates a guess.
 */
export function translateDesc(text) {
  if (!text) return text

  for (const [regex, fn] of PATTERN_RULES) {
    const m = text.match(regex)
    if (m) return fn(m)
  }

  if (EXACT_DICTIONARY[text]) return EXACT_DICTIONARY[text]

  const branded = translateBrand(text)
  if (branded !== text) return branded

  return text // untranslated — left as-is rather than guessed
}

const CHINESE_RE = /[\u4e00-\u9fff]/

/**
 * Recover the original (untranslated) note text from an Alipay-sourced
 * transaction's sourceKey, e.g. "alipay|2026-06-19 21:31:38|18.50|高德打车订单"
 * → "高德打车订单". Returns null if this isn't an Alipay sourceKey.
 */
export function reextractNoteFromSourceKey(sourceKey) {
  if (!sourceKey || !sourceKey.startsWith('alipay|')) return null
  const parts = sourceKey.split('|')
  if (parts.length < 4) return null
  return parts.slice(3).join('|') // rejoin in case the note itself contained "|"
}

/**
 * Re-translate every already-imported Alipay transaction's desc field,
 * using the original Chinese text recovered from its sourceKey. For
 * transactions imported before translation existed (or before a dictionary
 * entry was added), this retroactively applies translateDesc without
 * needing to re-upload the source file.
 *
 * `translateOptions` — { enabled: bool, apiKey: string } — same opt-in API
 * fallback as importAlipayFile, applied to anything still in Chinese after
 * the offline pass.
 *
 * Returns { updated: [...transactions], changed: number }
 */
export async function retranslateAlipayTransactions(transactions, translateOptions = {}) {
  let changed = 0
  const updated = transactions.map(t => {
    if (t.source !== 'alipay') return t
    const note = reextractNoteFromSourceKey(t.sourceKey)
    if (!note) return t
    const translated = translateDesc(note)
    if (translated === t.desc) return t
    changed++
    return { ...t, desc: translated }
  })

  if (translateOptions.enabled && translateOptions.apiKey) {
    const candidates = []
    updated.forEach((t, i) => { if (t.source === 'alipay' && CHINESE_RE.test(t.desc)) candidates.push(i) })
    if (candidates.length) {
      const texts = candidates.map(i => updated[i].desc)
      const translated = await translateBatch(texts, translateOptions.apiKey)
      candidates.forEach((idx, j) => {
        if (translated[j] && translated[j] !== updated[idx].desc) {
          updated[idx] = { ...updated[idx], desc: translated[j] }
          changed++
        }
      })
    }
  }

  return { updated, changed }
}

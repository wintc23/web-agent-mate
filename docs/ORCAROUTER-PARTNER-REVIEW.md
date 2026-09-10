# OrcaRouter 合作接入与 Chrome Web Store 政策研究

核对及初次实现日期：2026-09-09；连接方式更新：2026-09-10。范围：推广归因、用户利益、授权入口与相关披露。本记录不是完整的扩展上架审计，也不代表平台预先批准。下面先记录本次实现，再保留初始研究与方案比较；咨询稿未发送，尚未发布到商店。

## 本次实现

### 2026-09-10 发布准备核对

- README 顶部采用 [OrcaRouter 推广注册链接](https://www.orcarouter.ai/register?ref=ref_22606f54f9038927f996)，中英文均显示佣金说明。在独立、未登录的浏览器访问该地址后，注册页正常显示，站点将 `ref_22606f54f9038927f996` 保存为本地 `ref`。这验证了参数接收，未创建账号或验证实际佣金结算。
- 原有文档、服务条款、账单、错误恢复及 API 地址不改为推广链接。
- 授权参数为 `app_name=WebAgentMate`、`scope=api`、PKCE S256、随机 `state` 和上述 `ref`；代码尚无 `app_id`。
- 当前 manifest 公钥对应扩展 ID `lmlkkallnnjijicmfmfdelnamcnhflfg`，开发回调为 `https://lmlkkallnnjijicmfmfdelnamcnhflfg.chromiumapp.org/orcarouter`。提交时仍需与商店实际分配的 ID 核对。
- 本轮 Playwriter 未连接到已登录的用户浏览器。公开合作后台会要求登录，因此本轮尚未重新确认合作状态、签发的应用标识或登记的回调；下文的 5% 分成和“未签发”属于 2026-09-09 的历史核对结果。

### 扩展内连接

在现有浏览器登录的 PKCE 授权 URL 中加入 `ref=ref_22606f54f9038927f996`。按用户最新要求，按钮上方以普通字重常显“推广登录”及佣金说明，并通过 `aria-describedby` 关联到登录按钮；按钮简化为“登录 OrcaRouter”，移除重复展示相同内容的 ⓘ。六种界面语言已同步。2026-09-10 按用户要求移除手动 Key 连接，只保留浏览器登录；验证连接和断开仍可用。没有添加 `app_id`，没有改写其他网页或账单链接，也没有承诺赠送额度。

`CHROMEWEBSTORE.md`、`PRIVACY.md` 和中英文 README 已按该实现更新。商店线上文案尚未修改。佣金说明已从仅在提示中显示改为默认可见；当前方案是否满足直接用户利益条件，仍未得到平台确认，本次实现不能作为已合规或已获奖励的证明。

初次推广接入验证（2026-09-09）：使用 Node.js 24 运行 `npm test`，86 项通过、0 项失败、0 项跳过。授权测试验证登录请求携带指定推广码且继续通过 PKCE、回调和 scope 检查，手动 Key 连接不启动推广登录。`npm run build` 包含六语言检查、TypeScript 检查与扩展构建。未使用真实新账号测试平台注册归因或佣金到账。

## 当前判断

WebAgentMate 确实通过 OrcaRouter 提供内置智能体功能，服务接入与产品用途有直接关系。但现有免费功能是否足以满足返佣政策中的用户利益条件，公开条款没有针对本场景给出明确结论。

实际接入提供了直接使用内置模型、省去手动复制和配置 API Key 的便利，可作为用户利益的论据。官方未明确要求专属奖励或额外额度，也未针对本场景确认这种便利是否充分。用户最终选择在现有登录入口加推广码并常显佣金说明，实际实现见上文。单独增加说明不能代替用户利益这一条件。

## 官方要求和解释边界

| 要求 | 对本项目的含义 |
| --- | --- |
| 推广计划须在商店详情、产品界面和安装前显著披露 | 只写 README、隐私政策或 OrcaRouter 授权页不足以代替扩展自身披露 |
| 使用推广链接、码或 cookie 前须有相关用户操作 | 用户应知道点击会产生推广归因；普通“登录”文案不宜隐含这一行为 |
| 须提供与核心功能相关的直接、透明用户利益 | “开发者获得佣金”本身不能证明用户获得了利益 |

以上来自 [Affiliate Ads 政策](https://developer.chrome.com/docs/webstore/program-policies/affiliate-ads/)。

[官方 FAQ](https://developer.chrome.com/docs/webstore/program-policies/affiliate-ads-faq) 强调利益应在该次行为发生时存在，但没有规定利益一定是专属奖励，也没有明确认可“普通免费 AI 服务 + 开发者返佣”这一组合。额外可用额度更容易举证，属于本项目的方案判断；普通免费档不能直接判定不合规，也不能直接视为合规证明。政策列举 donation，并未解释普通开源维护者返佣是否属于该例，不能自行将佣金改称捐赠。

[2025 年政策更新说明](https://developer.chrome.com/blog/cws-policy-update-affiliate-ads-2025) 将用户当时获得的实际价值作为重点。领取不了的优惠、等待名单、过期活动，以及只面向新用户却向所有人展示的权益，都不能直接当作已经交付的利益证据。

[政策总则](https://developer.chrome.com/docs/webstore/program-policies/policies) 覆盖整个产品体验，包括营销材料和落地页。因此，把推广移到 README 或官网，不应被当作自动豁免；应按其在安装和产品流程中的实际用途评估。

## 已核实的项目与平台事实

### 研究开始时的本地源码（实施前快照）

| 位置 | 当前行为 |
| --- | --- |
| `src/sidepanel.tsx:1431` | 当前入口渲染 `Workspace` |
| `src/workspace-controls.tsx:28` | `ConnectionPanel` 提供浏览器登录和手动 Key 两种方式 |
| `src/Workspace.tsx:542`、`src/messages.ts:18` | 登录发送 `auth:connect`，没有推广选择字段 |
| `src/background.ts:587` | 通过发现文档取得端点，构造 PKCE 授权 URL；未主动添加 `ref` 或 `app_id` |
| `src/orca-auth.ts:6` | 校验回调地址、state、code，并校验换取的 API Key 范围 |
| `src/workspace-controls.tsx:46` | 获取 Key 的入口直达 OrcaRouter 控制台 |
| `src/provider-notice.tsx:31` | 额度管理、账单和限流文档使用普通链接 |
| `tests/settings.test.ts` | 研究时已有模拟授权、PKCE、回调、scope 与凭据保留测试；后续实现与运行结果见文首 |

研究开始时，`CHROMEWEBSTORE.md` 与 `PRIVACY.md` 尚未说明推广归因和返佣安排；本次实现已补充。文档中的“没有广告/分析 SDK”与“没有推广商业关系”是两种不同声明，不能混用。

### OrcaRouter

本次会话中读取的[合作后台](https://www.orcarouter.ai/partner-dashboard)显示：项目为 `wintc23/web-agent-mate`，`oss` 计划已生效，分成比例 5%，推广码为 `ref_22606f54f9038927f996`；接入页显示未签发应用标识。后台设置和接入页未显示此推广码附带的新用户额度奖励。

[官方授权文档](https://docs.orcarouter.ai/getting-started/sign-in-with-orcarouter)区分两种归因：`ref` 记录授权流程中新注册的用户来源；已验证的 `app_id` 将签发 Key 的用量归属到应用，要求登记匹配的回调 URL。它们本身不等于额度领取接口。`app_id` 是公开标识，不是秘密。

研究判断：如果应用用量归因用于给开发者付佣金，应把商业用途一并披露和评估，不能因为参数名称不是 `ref` 就假定 Affiliate Ads 不适用。“Verified”表示 OrcaRouter 识别应用，不代表 Chrome 批准返佣设计。

[活动页](https://www.orcarouter.ai/zh-CN/offers)在本次读取时显示普通免费模型、0 个人人可领活动、0 个代金券，以及一个带候补按钮的活动。[免费模型文档](https://docs.orcarouter.ai/routing/free-models)说明免费调用受工作区限额约束。公开免费服务和独立活动均不能证明该推广码有额外奖励；也不能用“未查到”断言平台绝对不提供定制奖励。

## 接入方案比较

以下是针对当前证据的判断，不是 Google 的审核结论。

| 方案 | 判断 |
| --- | --- |
| 现有普通授权和手动 Key | 推荐作为当前基线；没有新增推广归因 |
| 给普通登录地址直接附加 `ref` | 缺少清楚的商业披露与操作预期，且用户利益依据尚未解决 |
| 独立“通过推广连接”入口，只有常规免费服务 | 知情和自愿性更清楚；仍须确认这类直接服务利益能否满足政策 |
| 独立推广入口，提供经核实且用户符合资格的免费额度或优惠 | 用户利益更容易证明；仍需披露、主动操作及实际兑换验证，不保证过审 |
| 只传 `app_id` 获取用量分成 | 是另一种归因机制，不能作为规避推广政策的办法 |

## 条件明确后的具体实现建议

以下保留初始方案建议，不是最终实现；本次采用的入口形式见文首。

1. **保留普通连接。** 用户可通过普通登录或自己的 Key 使用内置智能体；Codex、Claude Code 的使用不应依赖接受推广。[Ads 政策](https://developer.chrome.com/docs/webstore/program-policies/ads)禁止强迫用户点击广告才能完整使用产品。
2. **在设置中放置可选合作入口。** 入口附近明确说明开发者获得分成、用户可获得的实际权益与领取条件。用户点击该入口后才启动带归因的授权。避免通过默认勾选或隐藏的历史偏好给普通登录附加推广。
3. **让选择跟随本次连接请求。** 在 `ConnectionPanel` → `Workspace.authAction` → 消息类型 → `background.connect` 之间显式传递连接目的；普通请求保持原有语义。推广码由扩展内部配置提供，不接受任意页面指定。此设计用于防止不同入口误共享归因状态。
4. **沿用现有 PKCE。** 继续使用 S256、随机 state、`chrome.identity.getRedirectURL("orcarouter")` 和回调校验。需要应用身份时，向 OrcaRouter 登记实际扩展回调，核对开发版与商店版身份。普通路径还应检查发现端点是否预带归因参数，避免仅依赖“不主动添加”。
5. **分别验证授权和权益到账。** 授权成功不能显示成“额度已领取”。只有官方规则和实际兑换结果支持时，才展示领取成功；不符合资格或活动结束时，提供普通连接。持久归因的解除条件由平台确认，不能暗示退出或断开 Key 会撤销历史注册归因。
6. **保持归因范围明确。** 不批量改写网页链接，不更新网站推广 cookie，不给已有 Key 补绑定，不在账单或错误恢复链接里自动添加推广码。模型推理继续使用正常 API 端点。
7. **使用包内 UI。** 不把 OrcaRouter 网页示例中的远程 `orca-connect-v1.js` 直接加载进扩展页面。现有按钮和授权实现已能完成流程；[MV3 要求](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements)限制此类远程脚本执行。
8. **同步实际披露。** 上线时更新商店描述、`CHROMEWEBSTORE.md`、`PRIVACY.md`、中英文 README 和六种界面语言。说明合作标识的发送、平台归因用途及开发者能看到的数据；平台尚未确认的 cookie、保留期限和报表字段不自行编造。[数据披露要求](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements)也要求显著说明安装后的数据处理变化。

可选入口的文案骨架：

> 使用 OrcaRouter 合作入口
>
> 通过此入口注册或连接后，符合合作计划规则的消费可能为 WebAgentMate 开发者带来分成。
> 用户权益：[经核实的权益及领取条件；没有确认则不承诺赠送额度]。
>
> [通过合作入口连接]  [普通连接]

这是待评审草稿，不是已经满足用户利益条件的文案。分成范围需按实际采用的 `ref` / `app_id` 机制改写；“用户不多付钱”等表述也须有平台依据。

若以后实施，应补充有意义的验证：普通入口不携带归因信息；合作入口只在相应点击后携带固定标识；取消和失败后不污染后续普通登录；既有 PKCE 测试继续通过；手动 Key、账单链接和其他引擎不被自动归因；授权成功与额度到账状态分开验证。真实奖励验证需要平台测试方式，不能靠模拟测试证明。

## 待官方确认的问题与咨询草稿

OrcaRouter 能确认奖励和归因规则；Chrome Web Store 能解释其审核政策，两者不能互相代替。公开文档不足以给本场景保证，以下草稿均未发送。

### 给 OrcaRouter

主题：WebAgentMate 开源合作的用户权益及归因规则确认

> 我们维护开源 Chrome 扩展 WebAgentMate：https://github.com/wintc23/web-agent-mate。
> 当前 OSS 推广码为 ref_22606f54f9038927f996，后台显示 5% 分成。
>
> 请确认通过该码注册的用户是否获得区别于常规注册的额度、优惠或其他权益。如有，请提供公开条款、资格、额度、有效期及领取/到账验证方式；如无，是否可以提供面向项目用户的活动？
>
> 我们还考虑通过 PKCE 的 app_id 接入：请说明与 ref 的分成优先级、已有用户与已有归因的处理，以及撤销授权后是否仍保留归因。请同时说明平台记录和向合作方展示哪些用户、用量或消费数据，以及如何解绑。
>
> 本地开发版本已在浏览器登录中加入推广码，按钮上方以普通字重常显推广标识及佣金说明；用户仍可使用自己的 Key。尚未发布这项改动。若仅申请认证应用身份，能否关闭商业归因？

### 给 Chrome Web Store

主题：Affiliate Ads clarification for an optional AI-provider connection

> We maintain WebAgentMate, an open-source Manifest V3 extension that reads and acts on user-requested webpages and connects to local workspaces. Its built-in agent uses OrcaRouter as a model provider.
>
> Our local development build includes a referral code in browser sign-in. A regular-weight disclosure immediately above the button identifies it as a referral entry and explains the commission, without a duplicate information tooltip. Browser sign-in is the sole connection method. Installation materials and drafted Store copy disclose the arrangement. We have not published this change. The extension does not rewrite third-party page links or inject affiliate cookies. Does this UI satisfy the prominent-disclosure requirement?
>
> OrcaRouter offers a standard free model tier, but we have not confirmed referral-specific credits. Does connecting users to that free service through the extension satisfy the direct-user-benefit condition without an additional reward? Would verified, redeemable promotional API credit change the assessment?
>
> Separately, OrcaRouter can attribute API-key usage through a verified app_id and pay the developer a commission. Does Affiliate Ads apply to that arrangement as well? Which additional disclosures or controls would you expect for this exact flow?
>
> Repository: https://github.com/wintc23/web-agent-mate

官方建议通过 [Chrome Web Store 支持渠道](https://developer.chrome.com/docs/webstore/review-process#developer-communication)处理此类问题。咨询是请求解释，不应假定支持团队一定提供预审批；最终仍以实际实现和审核结果为准。

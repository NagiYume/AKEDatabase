<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuery } from '@tanstack/vue-query'
import { EmptyState, ErrorState, ImageWithFallback, LoadingState } from '@ake/ui'
import { useAppContext } from '../../../app/providers/app-context'
import { userErrorMessageKey } from '../../../shared/i18n'
import { getAboutRepository } from '../api/repository'

defineOptions({ name: 'AboutPage' })

const { t, te, locale } = useI18n()
const { client, dataState, config } = useAppContext()
const repository = getAboutRepository(client)

const fallbackCopy: Readonly<Record<string, { en: string; zh: string }>> = {
  'modules.about.introduction.title': { en: '📘 About AKEData', zh: '📘 AKEData 项目介绍' },
  'modules.about.introduction.aiNotice': {
    en: 'Please note: this project makes extensive use of artificial intelligence, including for the documentation below.',
    zh: '观前提示：本项目大量使用了人工智能技术（包括下面的文档）'
  },
  'modules.about.introduction.summary': {
    en: 'This is a fan-made Arknights: Endfield project designed to make game data easy to browse and view.',
    zh: '本项目为《明日方舟：终末地》玩家自制作品，旨在提供便捷的游戏数据查询与展示功能。'
  },
  'modules.about.introduction.authorLabel': { en: 'Author: ', zh: '作者：' },
  'modules.about.features.title': { en: '✨ Core Features', zh: '✨ 核心功能' },
  'modules.about.features.separator': { en: ' - ', zh: ' - ' },
  'modules.about.features.dynamicNavigation.name': {
    en: 'Dynamic module navigation',
    zh: '动态模块导航'
  },
  'modules.about.features.dynamicNavigation.beforeManifest': {
    en: 'The sidebar builds its module list from ',
    zh: '左侧栏根据 '
  },
  'modules.about.features.dynamicNavigation.afterManifest': {
    en: ' and loads the corresponding HTML when selected.',
    zh: ' 动态生成模块列表，点击加载对应 HTML。'
  },
  'modules.about.features.globalSettings.name': { en: 'Global settings', zh: '全局设置' },
  'modules.about.features.globalSettings.description': {
    en: 'The gear button in the lower-left corner switches between light and dark themes and controls whether modules under development are shown.',
    zh: '左下角齿轮按钮可切换亮/暗主题、控制隐藏模块的显示（开发中内容）。'
  },
  'modules.about.features.linkPopups.name': { en: 'Link popups', zh: '超链接浮窗' },
  'modules.about.features.linkPopups.beforeTags': {
    en: 'Two-level popups parse ',
    zh: '支持双层浮窗，解析 '
  },
  'modules.about.features.linkPopups.betweenTags': { en: ' and ', zh: ' 和 ' },
  'modules.about.features.linkPopups.afterTags': {
    en: ' tags to display detailed descriptions.',
    zh: ' 标签，显示详细描述。'
  },
  'modules.about.features.tagParsing.name': { en: 'Tag parsing', zh: '标签解析' },
  'modules.about.features.tagParsing.beforeFunction': { en: 'The global ', zh: '全局 ' },
  'modules.about.features.tagParsing.afterFunction': {
    en: ' function handles style and hyperlink tags in text with a nesting-depth limit.',
    zh: ' 函数处理文本中的样式标签和超链接标签，支持嵌套深度限制。'
  },
  'modules.about.usage.title': { en: '🚀 How to Use', zh: '🚀 如何使用' },
  'modules.about.usage.hint': {
    en: 'Select a module to start using it.',
    zh: '直接点击使用即可'
  },
  'modules.about.usage.modules.weapon.name': { en: 'Weapons', zh: '武器模块' },
  'modules.about.usage.modules.weapon.description': {
    en: 'View base attack, skill data, and background stories for weapons.',
    zh: '查看武器基础攻击力、技能数据、背景故事。'
  },
  'modules.about.usage.modules.character.name': { en: 'Characters', zh: '角色模块' },
  'modules.about.usage.modules.character.description': {
    en: 'View operator stat growth, talents, potentials, skills, profiles, voice lines, and more. (Administrator data 0002 and 0003 is discarded; use data 9000 instead.)',
    zh: '查看干员属性成长、天赋、潜能、技能、档案、语音等。（0002，0003管理员的数据为废案，请以9000的数据为准）'
  },
  'modules.about.usage.modules.enemy.name': { en: 'Enemies', zh: '敌人模块' },
  'modules.about.usage.modules.enemy.description': {
    en: 'View enemy details, damage-taken multipliers, and variant stat tables.',
    zh: '查看敌人基本信息、承伤系数、变种属性表格。'
  },
  'modules.about.usage.modules.equipment.name': { en: 'Equipment', zh: '装备模块' },
  'modules.about.usage.modules.equipment.description': {
    en: 'View equipment set effects and the primary and secondary stats of each piece.',
    zh: '查看装备套组效果及各个部件的主副词条。'
  },
  'modules.about.usage.modules.medal.name': { en: 'Medals', zh: '奖章模块' },
  'modules.about.usage.modules.medal.description': {
    en: 'View medal data.',
    zh: '查看蚀刻章数据。'
  },
  'modules.about.usage.modules.dungeon.name': { en: 'Dungeons', zh: '副本模块' },
  'modules.about.usage.modules.dungeon.description': {
    en: 'View dungeon information and enemy data for each dungeon.',
    zh: '查看副本信息以及副本内怪物数据。'
  },
  'modules.about.partners.title': { en: '✨ Data Partners', zh: '✨ 数据合作' },
  'modules.about.partners.introduction': {
    en: 'This project also provides data support for the following tools and websites:',
    zh: '本项目同时也为以下工具/网站提供数据支持：'
  },
  'modules.about.partners.perlicaBot': {
    en: 'A QQ bot and Arknights: Endfield game assistant.',
    zh: 'QQ机器人，《明日方舟：终末地》游戏助手。'
  },
  'modules.about.partners.endfieldAtlas': {
    en: 'An interactive map for Arknights: Endfield.',
    zh: '《明日方舟：终末地》地图工具。'
  },
  'modules.about.partners.cepPlanner': {
    en: 'An all-in-one Arknights: Endfield toolkit for matrix planning and calculations, gear refinement planning, character guides, banner calendars, and more.',
    zh: '《明日方舟：终末地》规划工具集——基质规划与计算、精锻规划与计算、角色攻略、卡池日历等一站式解决方案。'
  },
  'modules.about.partners.endaxis': {
    en: 'A combat rotation simulator for Arknights: Endfield.',
    zh: '《明日方舟：终末地》排轴模拟器。'
  },
  'modules.about.partners.combatLogs': {
    en: 'An Arknights: Endfield combat log and speedrun ranking website.',
    zh: '《明日方舟：终末地》战斗数据记录工具，竞速排行网站。'
  },
  'modules.about.partners.yituliu': {
    en: 'Material-value, efficiency, pull-saving, and other compact Endfield tools.',
    zh: '《明日方舟：终末地》材料价值计算、性价比计算，以及攒抽计算等其它小工具。'
  },
  'modules.about.sponsor.title': { en: '✨ Sponsor the Project ✨', zh: '✨ 赞助支持 ✨' },
  'modules.about.sponsor.description': {
    en: 'Your sponsorship supports server maintenance, feature development, and content creation. Notes you provide will appear in the manually updated sponsor list. Please say so if you prefer not to be listed. Your encouragement and recognition help keep this project going. Advertising space is also available.',
    zh: '您的赞助将用于服务器维护、功能开发、内容创作；您在备注中填写的内容会显示在赞助列表中（手动更新）。如不希望在赞助列表中被记录请注明；您的鼓励与认可是我维护的动力!!!（广告位招租）'
  },
  'modules.about.sponsor.alipayNotice': {
    en: 'Alipay does not provide sponsor details reliably. If you sponsor through Alipay and want your name and note displayed, please send me a screenshot through any contact channel.',
    zh: '由于支付宝渠道无法正常获取赞助者信息，如果您通过支付宝赞助并需要署名及添加备注，请通过任意渠道私发我您的赞助截图'
  },
  'modules.about.sponsor.payment.wechat': { en: 'WeChat', zh: '微信' },
  'modules.about.sponsor.payment.wechatAlt': {
    en: 'WeChat sponsorship QR code',
    zh: '微信赞赏码'
  },
  'modules.about.sponsor.payment.alipay': { en: 'Alipay', zh: '支付宝' },
  'modules.about.sponsor.payment.alipayAlt': {
    en: 'Alipay payment QR code',
    zh: '支付宝收款码'
  },
  'modules.about.sponsor.thanks': {
    en: '✨ Thank You for Your Support ✨',
    zh: '✨ 感谢支持 ✨'
  },
  'modules.about.sponsor.loading': { en: 'Loading sponsors...', zh: '加载赞助列表...' },
  'modules.about.sponsor.loadFailed': {
    en: 'Failed to load sponsors. Please try again later.',
    zh: '加载赞助列表失败，请稍后重试。'
  },
  'modules.about.sponsor.empty': {
    en: 'No sponsorships yet. Your support is appreciated!',
    zh: '暂无赞助记录，期待您的支持！'
  },
  'modules.about.sponsor.noRemarks': { en: 'No note', zh: '无备注' },
  'modules.about.contact.title': { en: '🔧 Contact', zh: '🔧 联系我们' },
  'modules.about.contact.description': {
    en: 'Contact the developer through any of the channels below to report bugs or suggest features. Authors of other tools and developers who need data support from this website are also welcome to get in touch.',
    zh: '您可以通过以下方式联系开发者进行 bug 反馈和新功能提议，若您是其他工具的作者或者相关开发者需要本网站提供数据支持，也欢迎您通过下面的方式联系我。'
  },
  'modules.about.contact.bilibiliLabel': { en: 'BiliBili: ', zh: 'BiliBili：' },
  'modules.about.contact.feedbackGroupLabel': { en: 'Feedback group: ', zh: '用户反馈群：' },
  'modules.about.contact.feedbackGroupPurpose': {
    en: ' (data partnerships and bug reports)',
    zh: '（数据合作 & bug 反馈）'
  },
  'modules.about.contact.repositoryLabel': { en: 'Repository: ', zh: '项目地址：' }
}

function tr(key: string): string {
  if (te(key)) return String(t(key))
  const fallback = fallbackCopy[key]
  return fallback ? (locale.value === 'CH' ? fallback.zh : fallback.en) : key
}

const {
  data: sponsors,
  isPending,
  isError,
  error,
  refetch
} = useQuery({
  queryKey: computed(() => [
    'about',
    'sponsors',
    dataState.value.baseUrl,
    dataState.value.manifest.sharedRevision
  ]),
  queryFn: ({ signal }) => repository.sponsors(signal)
})

const usageModules = ['weapon', 'character', 'enemy', 'equipment', 'medal', 'dungeon'] as const
const partners = [
  { name: 'Perlica Bot', url: 'https://bot.perlica.tech/', key: 'perlicaBot' },
  { name: '终末地地图集', url: 'https://opendfieldmap.cn/', key: 'endfieldAtlas' },
  { name: 'CEP 终末地基质规划器', url: 'https://end.canmoe.com/', key: 'cepPlanner' },
  { name: '排轴终端 - Endaxis', url: 'https://www.end-axis.com/', key: 'endaxis' },
  { name: '终末地战斗日志', url: 'https://zmdlogs.com/', key: 'combatLogs' },
  { name: '终末地一图流', url: 'https://ef.yituliu.cn/', key: 'yituliu' }
] as const

function errorMessage(value: unknown): string {
  return String(t(userErrorMessageKey(value)))
}
</script>

<template>
  <div class="ake-ui about-module">
    <div class="about-content">
      <section data-about-section="introduction">
        <h2>{{ tr('modules.about.introduction.title') }}</h2>
        <p>{{ tr('modules.about.introduction.aiNotice') }}</p>
        <p>{{ tr('modules.about.introduction.summary') }}</p>
        <p>
          <span>{{ tr('modules.about.introduction.authorLabel') }}</span
          >渚汐奏梦
        </p>
      </section>

      <section data-about-section="features">
        <h3>{{ tr('modules.about.features.title') }}</h3>
        <ul>
          <li>
            <strong>{{ tr('modules.about.features.dynamicNavigation.name') }}</strong
            >{{ tr('modules.about.features.separator')
            }}{{ tr('modules.about.features.dynamicNavigation.beforeManifest')
            }}<code>plugin/manifest.json</code
            >{{ tr('modules.about.features.dynamicNavigation.afterManifest') }}
          </li>
          <li>
            <strong>{{ tr('modules.about.features.globalSettings.name') }}</strong
            >{{ tr('modules.about.features.separator')
            }}{{ tr('modules.about.features.globalSettings.description') }}
          </li>
          <li>
            <strong>{{ tr('modules.about.features.linkPopups.name') }}</strong
            >{{ tr('modules.about.features.separator')
            }}{{ tr('modules.about.features.linkPopups.beforeTags') }}<code>&lt;#tag&gt;</code
            >{{ tr('modules.about.features.linkPopups.betweenTags') }}<code>&lt;@tag&gt;</code
            >{{ tr('modules.about.features.linkPopups.afterTags') }}
          </li>
          <li>
            <strong>{{ tr('modules.about.features.tagParsing.name') }}</strong
            >{{ tr('modules.about.features.separator')
            }}{{ tr('modules.about.features.tagParsing.beforeFunction') }}<code>parseText</code
            >{{ tr('modules.about.features.tagParsing.afterFunction') }}
          </li>
        </ul>
      </section>

      <section data-about-section="usage">
        <h3>{{ tr('modules.about.usage.title') }}</h3>
        <p>{{ tr('modules.about.usage.hint') }}</p>
        <ul>
          <li v-for="moduleId in usageModules" :key="moduleId">
            <strong>{{ tr(`modules.about.usage.modules.${moduleId}.name`) }}</strong
            >{{ tr('modules.about.features.separator')
            }}{{ tr(`modules.about.usage.modules.${moduleId}.description`) }}
          </li>
        </ul>
      </section>

      <section data-about-section="partners">
        <h3>{{ tr('modules.about.partners.title') }}</h3>
        <p>{{ tr('modules.about.partners.introduction') }}</p>
        <ul class="partner-list">
          <li v-for="partner in partners" :key="partner.url">
            <strong>
              <a :href="partner.url" target="_blank" rel="noopener noreferrer">{{ partner.name }}</a>
            </strong>
            {{ tr('modules.about.features.separator') }}{{ tr(`modules.about.partners.${partner.key}`) }}
          </li>
        </ul>
      </section>

      <section data-about-section="sponsor">
        <h3>{{ tr('modules.about.sponsor.title') }}</h3>
        <div class="sponsor-section">
          <div class="sponsor-intro">
            <p>{{ tr('modules.about.sponsor.description') }}</p>
            <p>{{ tr('modules.about.sponsor.alipayNotice') }}</p>
          </div>

          <div class="qr-container">
            <figure class="qr-item">
              <ImageWithFallback
                :src="client.resolveImageUrl('public/images/about/wechat.png')"
                :alt="tr('modules.about.sponsor.payment.wechatAlt')"
                width="180"
                height="180"
                aspect-ratio="1"
              />
              <figcaption>{{ tr('modules.about.sponsor.payment.wechat') }}</figcaption>
            </figure>
            <figure class="qr-item">
              <ImageWithFallback
                :src="client.resolveImageUrl('public/images/about/alipay.png')"
                :alt="tr('modules.about.sponsor.payment.alipayAlt')"
                width="180"
                height="180"
                aspect-ratio="1"
              />
              <figcaption>{{ tr('modules.about.sponsor.payment.alipay') }}</figcaption>
            </figure>
          </div>

          <div class="sponsor-list">
            <h4>{{ tr('modules.about.sponsor.thanks') }}</h4>
            <div id="sponsorGrid" class="sponsor-grid" aria-live="polite">
              <LoadingState v-if="isPending" compact :label="tr('modules.about.sponsor.loading')" />
              <ErrorState
                v-else-if="isError"
                compact
                :title="tr('modules.about.sponsor.loadFailed')"
                :description="errorMessage(error)"
                :retry-label="String(t('common.retry'))"
                @retry="refetch()"
              />
              <EmptyState v-else-if="!sponsors?.length" compact :title="tr('modules.about.sponsor.empty')" />
              <template v-else>
                <article v-for="sponsor in sponsors" :key="sponsor.id" class="sponsor-card">
                  <div class="sponsor-name">{{ sponsor.name }}</div>
                  <div class="sponsor-money" :class="`rarity-${sponsor.rarity}`">{{ sponsor.money }}</div>
                  <time class="sponsor-time">{{ sponsor.time }}</time>
                  <div class="sponsor-content">
                    {{ sponsor.content || tr('modules.about.sponsor.noRemarks') }}
                  </div>
                </article>
              </template>
            </div>
          </div>
        </div>
      </section>

      <section data-about-section="contact">
        <h3>{{ tr('modules.about.contact.title') }}</h3>
        <p>{{ tr('modules.about.contact.description') }}</p>
        <p>
          <span>{{ tr('modules.about.contact.bilibiliLabel') }}</span>
          <a href="https://space.bilibili.com/694452100" target="_blank" rel="noopener noreferrer"
            >渚汐奏梦</a
          >
        </p>
        <p>
          <span>{{ tr('modules.about.contact.feedbackGroupLabel') }}</span
          >1091817282<span>{{ tr('modules.about.contact.feedbackGroupPurpose') }}</span>
        </p>
        <p>
          <span>{{ tr('modules.about.contact.repositoryLabel') }}</span>
          <a href="https://github.com/nagiyume/akedatabase" target="_blank" rel="noopener noreferrer"
            >GitHub</a
          >
        </p>
        <p class="about-contact-version">{{ String(t('common.version')) }}：{{ config.appversion }}</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.about-module {
  width: 100%;
  max-width: 900px;
  padding: 30px;
  margin: 0 auto;
  color: var(--ake-color-text);
  line-height: 1.6;
}

.about-content h2 {
  padding-block-end: 10px;
  margin-block: 0 20px;
  border-block-end: 2px solid var(--ake-color-border);
  font-size: 2rem;
}

.about-content h3 {
  margin: 30px 0 15px;
  color: var(--ake-color-accent);
  font-size: 1.4rem;
}

.about-content h4 {
  margin-block: 0 16px;
  font-size: 1.125rem;
}

.about-content p {
  margin-block: 0 15px;
}

.about-content ul {
  padding-inline-start: 20px;
  margin-block: 0 20px;
}

.about-content li {
  margin-block-end: 5px;
}

.about-content code {
  padding: 0.1em 0.3em;
  border-radius: var(--ake-radius-sm);
  color: var(--ake-color-code-text);
  background: var(--ake-color-code);
  font-family: var(--ake-font-mono);
  font-size: 0.9em;
}

.about-content a {
  color: var(--ake-color-accent);
  text-underline-offset: 0.16em;
}

.about-content a:hover {
  color: var(--ake-color-accent-hover);
}

.sponsor-section {
  padding-block-start: 30px;
  margin-block-start: 40px;
  border-block-start: 2px solid var(--ake-color-border);
}

.sponsor-intro {
  padding: 16px;
  margin-block-end: 24px;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-lg);
  color: var(--ake-color-text-muted);
  background: var(--ake-color-surface-muted);
  line-height: 1.6;
}

.sponsor-intro p:last-child {
  margin-block-end: 0;
}

.qr-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 40px;
  margin: 30px 0;
}

.qr-item {
  width: 180px;
  margin: 0;
  text-align: center;
}

.qr-item :deep(.ake-image) {
  width: 180px;
  height: 180px;
  padding: 8px;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-lg);
  background: #fff;
}

.qr-item figcaption {
  margin-block-start: 8px;
  color: var(--ake-color-text);
  font-weight: 500;
}

.sponsor-list {
  margin-block-start: 30px;
}

.sponsor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 16px;
}

.sponsor-grid > :not(.sponsor-card) {
  grid-column: 1 / -1;
}

.sponsor-card {
  min-width: 0;
  padding: 16px;
  border: var(--ake-border-width) solid var(--ake-color-border);
  border-radius: var(--ake-radius-lg);
  background: var(--ake-color-surface-muted);
  transition:
    transform var(--ake-duration-normal) var(--ake-ease-standard),
    box-shadow var(--ake-duration-normal) var(--ake-ease-standard);
}

.sponsor-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--ake-shadow-popover);
}

.sponsor-name {
  margin-block-end: 4px;
  color: var(--ake-color-text);
  font-size: 1.1rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.sponsor-money {
  margin: 8px 0;
  font-size: 1.2rem;
  font-weight: 700;
}

.sponsor-money.rarity-1 {
  color: var(--ake-color-text-muted);
}

.sponsor-money.rarity-2 {
  color: var(--ake-color-success);
}

.sponsor-money.rarity-3 {
  color: var(--ake-color-accent);
}

.sponsor-money.rarity-4 {
  color: #8a4db7;
}

.sponsor-money.rarity-5 {
  color: var(--ake-color-warning);
}

.sponsor-money.rarity-6 {
  color: var(--ake-color-danger);
}

.sponsor-time {
  display: block;
  margin: 4px 0;
  color: var(--ake-color-text-muted);
  font-size: 0.8rem;
}

.sponsor-content {
  padding-block-start: 8px;
  margin-block-start: 8px;
  border-block-start: var(--ake-border-width) dashed var(--ake-color-border);
  color: var(--ake-color-text-muted);
  font-size: 0.9rem;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.about-contact-version {
  color: var(--ake-color-text-muted);
}

@media (max-width: 40rem) {
  .about-module {
    padding: 20px 16px;
  }

  .about-content h2 {
    font-size: 1.75rem;
  }

  .qr-container {
    gap: 24px;
  }
}
</style>

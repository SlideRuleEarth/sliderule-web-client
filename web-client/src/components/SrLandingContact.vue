<script setup lang="ts">
interface LinkedReason {
  text: string
  linkText: string
  href: string
  after: string
}

const CHANNELS: {
  icon: string
  title: string
  reasons: (string | LinkedReason)[]
  cta: string
  href: string
}[] = [
  {
    icon: 'pi pi-envelope',
    title: 'Email us directly',
    reasons: [
      'Organizational questions: who we are and future collaboration opportunities',
      'Sensitive questions that should not be posted publicly',
      'When you just need a real person to help address an issue'
    ],
    cta: 'support@slideruleearth.io',
    href: 'mailto:support@slideruleearth.io'
  },
  {
    icon: 'pi pi-exclamation-circle',
    title: 'Open an issue',
    reasons: [
      'Problems you encounter while using SlideRule',
      'Bugs in the code',
      'Feature requests'
    ],
    cta: 'GitHub issues',
    href: 'https://github.com/SlideRuleEarth/sliderule/issues'
  },
  {
    icon: 'pi pi-comments',
    title: 'Start a discussion',
    reasons: [
      'Help to install, run, or interface with SlideRule',
      'Questions about how things work',
      'Ideas you want to share and get people thinking about'
    ],
    cta: 'GitHub discussions',
    href: 'https://github.com/orgs/SlideRuleEarth/discussions'
  },
  {
    icon: 'pi pi-github',
    title: 'Open a pull request',
    reasons: [
      'Bug fixes you have already made to the code base',
      'Features you have implemented and want in a future release',
      {
        text: 'Before opening a pull request, please read our ',
        linkText: 'contribution guidelines',
        href: 'https://docs.slideruleearth.io/getting-started/contributing',
        after: '.'
      }
    ],
    cta: 'GitHub pull requests',
    href: 'https://github.com/SlideRuleEarth/sliderule/pulls'
  }
]
</script>

<template>
  <div class="sr-contact">
    <h2 class="sr-contact-heading">Get in touch</h2>
    <p class="sr-contact-lead">
      SlideRule is developed in the open. Pick the channel that fits what you need.
    </p>

    <div class="sr-contact-grid">
      <div v-for="c in CHANNELS" :key="c.title" class="sr-contact-card">
        <i :class="['sr-contact-icon', c.icon]" aria-hidden="true"></i>
        <h3 class="sr-contact-title">{{ c.title }}</h3>
        <ul class="sr-contact-reasons">
          <li v-for="r in c.reasons" :key="typeof r === 'string' ? r : r.href">
            <template v-if="typeof r === 'string'">{{ r }}</template>
            <template v-else
              >{{ r.text
              }}<a :href="r.href" target="_blank" rel="noopener noreferrer">{{ r.linkText }}</a
              >{{ r.after }}</template
            >
          </li>
        </ul>
        <a
          :href="c.href"
          class="sr-contact-cta"
          :target="c.href.startsWith('mailto:') ? undefined : '_blank'"
          :rel="c.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'"
        >
          {{ c.cta }}
          <i
            :class="c.href.startsWith('mailto:') ? 'pi pi-arrow-right' : 'pi pi-external-link'"
            aria-hidden="true"
          ></i>
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sr-contact {
  --sr-accent: var(--p-orange-400);
  max-width: 72rem;
  margin: 0 auto;
  padding: 2rem 0 3rem;
}

.sr-contact-heading {
  margin: 0 0 0.5rem;
  font-size: 1.75rem;
  font-weight: 600;
  color: #ffffff;
  text-align: center;
}

.sr-contact-lead {
  margin: 0 auto 2rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.65);
}

.sr-contact-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
}

.sr-contact-card {
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 1rem;
  padding: 1.5rem;
}

.sr-contact-icon {
  font-size: 1.4rem;
  color: var(--sr-accent);
}

.sr-contact-title {
  margin: 0.75rem 0 0.5rem;
  font-size: 1.1rem;
  color: #ffffff;
}

.sr-contact-reasons {
  flex: 1;
  margin: 0 0 1.25rem;
  padding-left: 1.1rem;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.95rem;
}

.sr-contact-reasons li {
  padding: 0.1rem 0;
}

.sr-contact-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  align-self: flex-start;
  color: var(--p-primary-color);
  font-weight: 600;
  text-decoration: none;
}

.sr-contact-cta:hover {
  text-decoration: underline;
}

.sr-contact-cta .pi {
  font-size: 0.75rem;
}

.sr-contact-reasons a {
  color: var(--p-primary-color);
}

@media (max-width: 900px) {
  .sr-contact-grid {
    grid-template-columns: 1fr;
  }
}
</style>

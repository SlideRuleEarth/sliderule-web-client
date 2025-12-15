<script setup lang="ts">
import SingleColumnLayout from '@/layouts/SingleColumnLayout.vue'
import Card from 'primevue/card'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
</script>

<template>
  <SingleColumnLayout>
    <template v-slot:sr-single-col>
      <Card class="sr-privacy-card">
        <template #title>
          <div class="sr-privacy-title">Privacy Policy</div>
        </template>
        <template #subtitle>
          <div class="sr-privacy-subtitle">Last updated: December 2025</div>
        </template>
        <template #content>
          <div class="sr-privacy-intro">
            <p>
              SlideRule Earth is committed to protecting your privacy. This policy explains what
              data we collect, why we collect it, and how you can control it.
            </p>
          </div>

          <Accordion :multiple="true" class="sr-privacy-accordion">
            <AccordionPanel value="0">
              <AccordionHeader>What We Collect</AccordionHeader>
              <AccordionContent>
                <div class="sr-privacy-section">
                  <h4>Authentication Data</h4>
                  <ul>
                    <li>
                      <strong>GitHub OAuth tokens</strong> - Used to verify your membership in the
                      SlideRuleEarth organization
                    </li>
                    <li>
                      <strong>Username</strong> - Your GitHub username for display and
                      authentication
                    </li>
                    <li>
                      <strong>Organization membership</strong> - Whether you're a member or owner of
                      SlideRuleEarth
                    </li>
                  </ul>

                  <h4>Device Information</h4>
                  <ul>
                    <li><strong>Browser type</strong> - To ensure compatibility</li>
                    <li><strong>Operating system</strong> - To optimize the user experience</li>
                    <li><strong>Screen size</strong> - To provide responsive layouts</li>
                  </ul>

                  <h4>User Preferences</h4>
                  <ul>
                    <li><strong>Configuration settings</strong> - Domain, cluster preferences</li>
                    <li>
                      <strong>Tour completion status</strong> - Whether you've seen the intro tour
                    </li>
                    <li>
                      <strong>Google API key</strong> - If you provide one for satellite imagery
                    </li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionPanel>

            <AccordionPanel value="1">
              <AccordionHeader>Why We Collect It</AccordionHeader>
              <AccordionContent>
                <div class="sr-privacy-section">
                  <ul>
                    <li>
                      <strong>Authentication</strong> - To verify your identity and provide access
                      to member features
                    </li>
                    <li>
                      <strong>App Functionality</strong> - To remember your settings and provide a
                      seamless experience
                    </li>
                    <li>
                      <strong>Compatibility</strong> - To ensure the application works correctly on
                      your device
                    </li>
                    <li>
                      <strong>User Experience</strong> - To avoid showing you the same tour
                      repeatedly
                    </li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionPanel>

            <AccordionPanel value="2">
              <AccordionHeader>How We Store It</AccordionHeader>
              <AccordionContent>
                <div class="sr-privacy-section">
                  <p>
                    All data is stored locally in your browser. We do not send your data to external
                    analytics services.
                  </p>

                  <h4>Session Storage (cleared when you close the tab)</h4>
                  <ul>
                    <li>Authentication tokens</li>
                    <li>Google API session tokens</li>
                  </ul>

                  <h4>Local Storage (persists until you clear it)</h4>
                  <ul>
                    <li>Configuration preferences (domain, cluster)</li>
                    <li>Tour completion status</li>
                    <li>Privacy consent preferences</li>
                  </ul>

                  <h4>IndexedDB (Application Database)</h4>
                  <ul>
                    <li>Request history and metadata</li>
                    <li>Color preferences and plot configurations</li>
                    <li>Request summaries and run contexts</li>
                  </ul>

                  <h4>Origin Private File System (OPFS)</h4>
                  <ul>
                    <li>Cached parquet data files from your requests</li>
                    <li>These are scientific data files you've fetched from SlideRule servers</li>
                  </ul>

                  <p class="sr-privacy-note">
                    <strong>Note:</strong> You can clear all stored data at any time from the
                    Settings page using "Clear All My Data" - this includes IndexedDB and cached
                    files.
                  </p>
                </div>
              </AccordionContent>
            </AccordionPanel>

            <AccordionPanel value="3">
              <AccordionHeader>Third-Party Services</AccordionHeader>
              <AccordionContent>
                <div class="sr-privacy-section">
                  <h4>GitHub OAuth</h4>
                  <p>
                    We use GitHub for authentication. When you log in, GitHub shares your username
                    and organization membership with us. See
                    <a
                      href="https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement"
                      target="_blank"
                      rel="noopener"
                      >GitHub's Privacy Statement</a
                    >.
                  </p>

                  <h4>Google Maps/Tiles API</h4>
                  <p>
                    If you provide a Google API key for satellite imagery, requests are made to
                    Google's servers. See
                    <a href="https://policies.google.com/privacy" target="_blank" rel="noopener"
                      >Google's Privacy Policy</a
                    >.
                  </p>

                  <h4>SlideRule Earth Servers</h4>
                  <p>
                    When you make data requests, they are processed by SlideRule Earth servers.
                    Request parameters are sent but no personal data beyond your authentication
                    token.
                  </p>
                </div>
              </AccordionContent>
            </AccordionPanel>

            <AccordionPanel value="4">
              <AccordionHeader>Your Rights</AccordionHeader>
              <AccordionContent>
                <div class="sr-privacy-section">
                  <p>You have the right to:</p>
                  <ul>
                    <li>
                      <strong>Access your data</strong> - View what's stored in Settings → Storage
                      Usage
                    </li>
                    <li>
                      <strong>Delete your data</strong> - Use "Clear All My Data" in Settings →
                      Privacy & Data
                    </li>
                  </ul>

                  <h4>No Non-Essential Data Collection</h4>
                  <p>
                    We only collect data that is essential for the application to function. We do
                    not use analytics, tracking cookies, or collect data for marketing purposes. All
                    stored data serves a direct functional purpose such as authentication, user
                    preferences, or display optimization.
                  </p>

                  <h4>Global Privacy Control (GPC)</h4>
                  <p>
                    We detect and respect the Global Privacy Control signal. Since we only collect
                    essential data, your experience remains the same whether or not GPC is enabled.
                  </p>
                </div>
              </AccordionContent>
            </AccordionPanel>

            <AccordionPanel value="5">
              <AccordionHeader>Contact Us</AccordionHeader>
              <AccordionContent>
                <div class="sr-privacy-section">
                  <p>
                    If you have questions about this privacy policy or your data, contact us at:
                  </p>
                  <p>
                    <a href="mailto:support@mail.slideruleearth.io"
                      >support@mail.slideruleearth.io</a
                    >
                  </p>
                  <p>
                    You can also open an issue on our
                    <a href="https://github.com/SlideRuleEarth" target="_blank" rel="noopener"
                      >GitHub repository</a
                    >.
                  </p>
                </div>
              </AccordionContent>
            </AccordionPanel>
          </Accordion>
        </template>
      </Card>
    </template>
  </SingleColumnLayout>
</template>

<style scoped>
.sr-privacy-card {
  display: block;
  width: 50rem;
  max-width: 95vw;
  margin: 0 auto;
  padding: 1rem;
  background: var(--p-surface-900, var(--surface-ground, #121212));
  border-radius: 10px;
  box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.3);
}

.sr-privacy-title {
  display: flex;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: bold;
  text-align: center;
  width: 100%;
  margin-bottom: 0.5rem;
}

.sr-privacy-subtitle {
  text-align: center;
  color: var(--p-text-muted-color, #888);
  font-size: 0.9rem;
}

.sr-privacy-intro {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--p-surface-800, #1e1e1e);
  border: 1px solid var(--p-surface-600, #3e3e3e);
  border-radius: 8px;
}

.sr-privacy-intro p {
  margin: 0;
  line-height: 1.6;
}

.sr-privacy-accordion {
  width: 100%;
}

.sr-privacy-section {
  line-height: 1.6;
}

.sr-privacy-section h4 {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  color: var(--p-primary-color, #60a5fa);
}

.sr-privacy-section h4:first-child {
  margin-top: 0;
}

.sr-privacy-section ul {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.sr-privacy-section li {
  margin-bottom: 0.5rem;
}

.sr-privacy-section a {
  color: var(--p-primary-color, #60a5fa);
  text-decoration: underline;
}

.sr-privacy-section a:hover {
  color: var(--p-primary-400, #93c5fd);
}

.sr-privacy-note {
  margin-top: 1rem;
  padding: 0.75rem;
  background: var(--p-surface-800, #1e1e1e);
  border-left: 3px solid var(--p-primary-color, #60a5fa);
  border-radius: 4px;
}

:deep(.p-accordion-content) {
  padding: 1rem;
}
</style>

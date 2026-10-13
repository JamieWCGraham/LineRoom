import Script from "next/script";
import { analyticsEnabled } from "@/lib/analytics";
import {
  ANALYTICS_DOMAIN_OR_KEY,
  ANALYTICS_PROVIDER,
} from "@/lib/site-config";

/** Loads the configured analytics snippet. Renders nothing when disabled. */
export function AnalyticsScripts() {
  if (!analyticsEnabled()) return null;

  if (ANALYTICS_PROVIDER === "plausible") {
    return (
      <Script
        defer
        data-domain={ANALYTICS_DOMAIN_OR_KEY}
        src="https://plausible.io/js/script.js"
        strategy="afterInteractive"
      />
    );
  }

  if (ANALYTICS_PROVIDER === "posthog") {
    const key = ANALYTICS_DOMAIN_OR_KEY.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    return (
      <Script id="lineroom-posthog" strategy="afterInteractive">
        {`!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture".split(" ");for(n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init('${key}',{api_host:'https://us.i.posthog.com',person_profiles:'identified_only',autocapture:false});`}
      </Script>
    );
  }

  return null;
}

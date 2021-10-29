"use strict";
Object.defineProperty(
  typeof exports != "undefined"
    ? exports
    : typeof globalThis != "undefined"
    ? globalThis
    : self,
  "recaptcha_assessment",
  {
    value: Object.defineProperty(
      {
        default: function (opts) {
          var u = "undefined",
            s = "script",
            f = "function",
            d = document;

          var state = {
            siteKey: opts.siteKey,
            action: opts.action || "page_view",
            sendEvent: typeof opts.sendEvent === u ? false : opts.sendEvent,
            sendContext:
              typeof opts.sendContext === u ? true : opts.sendContext,
            schema:
              opts.schema ||
              "iglu:com.google.recaptcha/action/jsonschema/1-0-0",
            altDomain:
              opts.altDomain === true
                ? "www.recaptcha.net"
                : opts.altDomain || "www.google.com",
            callback:
              typeof opts.callback === "function" ? opts.callback : undefined,
            enterprise: !!opts.enterprise,

            token: undefined,
            challenge_ts: undefined,
            loaded: false,
            pending: 0,
          };

          if (typeof state.siteKey !== "string" || !state.siteKey) {
            console.warn("Snowplow/ReCAPTCHA: missing siteKey");
            return {};
          }

          function payload() {
            return {
              schema: state.schema,
              data: {
                token: state.token,
                site_key: state.siteKey,
                action: state.action,
                challenge_ts: state.challenge_ts,
              },
            };
          }

          return {
            activateBrowserPlugin: function (tracker) {
              state.pending++;
              if (
                !state.loaded &&
                (!window.grecaptcha ||
                  (typeof window.grecaptcha.execute !== f &&
                    (!window.grecaptcha.enterprise ||
                      typeof window.grecaptcha.enterprise.execute !== f)))
              ) {
                state.loaded = true;
                var scripts = d.getElementsByTagName(s);
                var api = d.createElement(s);
                api.src = [
                  "//",
                  state.altDomain,
                  "/recaptcha/",
                  state.enterprise ? "enterprise.js" : "api.js",
                  "?render=",
                  state.siteKey,
                ].join("");
                api.async = 1;
                api.addEventListener(
                  "load",
                  function () {
                    if (typeof grecaptcha === u) return;
                    var gr = grecaptcha.enterprise || grecaptcha;
                    gr.ready(function () {
                      state.challenge_ts = new Date();
                      gr.execute(state.siteKey, { action: state.action }).then(
                        function (token) {
                          state.token = token;
                          var trackerfn = tracker.id.replace(
                            "_" + tracker.namespace,
                            ""
                          );
                          if (
                            state.sendEvent &&
                            typeof window[trackerfn] === f
                          ) {
                            window[trackerfn]("trackSelfDescribingEvent", {
                              event: payload(),
                            });
                          }

                          if (state.callback) callback(token);
                        }
                      );
                    });
                  },
                  false
                );
                scripts[0].parentNode.insertBefore(api, scripts[0]);
                api = null;
              }
            },
            contexts: function () {
              if (state.sendContext && state.pending && state.token) {
                state.pending--;
                return [payload()];
              }
            },
          };
        },
      },
      "__esModule",
      { value: true }
    ),
  }
);

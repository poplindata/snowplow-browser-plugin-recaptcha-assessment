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

          var state = Object.assign(
            {
              token: undefined,
              challenge_ts: undefined,
              loaded: false,
              pending: 0,
            },
            {
              siteKey: opts.siteKey,
              sendEvent: typeof opts.sendEvent === u ? false : opts.sendEvent,
              sendContext:
                typeof opts.sendContext === u ? true : opts.sendContext,
              callback:
                typeof opts.callback === "function" ? opts.callback : undefined,
              params: Object.assign(
                opts.params || {},
                opts.hCaptcha ? { render: "explicit" } : {}
              ),
            },
            opts.hCaptcha
              ? {
                  hCaptcha: true,
                  schema:
                    opts.schema ||
                    "iglu:com.hcaptcha/challenge/jsonschema/1-0-0",
                  altDomain:
                    typeof opts.altDomain === "string"
                      ? opts.altDomain
                      : "js.hcaptcha.com",
                  pathPrefix: opts.pathPrefix || "/1/",
                  pathFileName: opts.pathFileName || "api.js",
                  enterprise: false,
                }
              : {
                  hCaptcha: false,
                  action: opts.action || "page_view",
                  schema:
                    opts.schema ||
                    "iglu:com.google.recaptcha/action/jsonschema/1-0-0",
                  altDomain:
                    opts.altDomain === true
                      ? "www.recaptcha.net"
                      : opts.altDomain || "www.google.com",
                  pathPrefix: opts.pathPrefix || "/recaptcha/",
                  pathFileName: opts.pathFileName || "api.js",
                  enterprise: !!opts.enterprise,
                }
          );

          if (typeof state.siteKey !== "string" || !state.siteKey) {
            console.warn("Snowplow/ReCAPTCHA: missing siteKey");
            return {};
          }

          state.params.render = state.params.render || state.siteKey;

          function payload() {
            return {
              schema: state.schema,
              data: {
                token: state.token,
                site_key: state.siteKey,
                action: !state.hCaptcha ? state.action : undefined,
                challenge_ts: state.challenge_ts,
              },
            };
          }

          return {
            activateBrowserPlugin: function (tracker) {
              state.pending++;
              var gr = window.grecaptcha || window.hcaptcha;
              if (
                !state.loaded &&
                (!gr ||
                  (typeof gr.execute !== f &&
                    (!gr.enterprise || typeof gr.enterprise.execute !== f)))
              ) {
                state.loaded = true;
                var scripts = d.getElementsByTagName(s);
                var api = d.createElement(s);
                var src = [
                  "//",
                  state.altDomain,
                  state.pathPrefix,
                  state.enterprise ? "enterprise.js" : state.pathFileName,
                  "?",
                ].join("");

                for (var p in state.params) {
                  if (state.params.hasOwnProperty(p)) {
                    src =
                      src +
                      ["&", p, "=", encodeURIComponent(state.params[p])].join(
                        ""
                      );
                  }
                }

                api.src = src;
                api.async = 1;

                api.addEventListener(
                  "load",
                  function () {
                    var gr = window.hcaptcha || window.grecaptcha;
                    gr = gr.enterprise || gr;
                    if (!gr) return;

                    var handler = function (token) {
                      if (!token) return;
                      state.token = token;

                      // at this point, tracker doesn't appear to include a trackSelfDescribingEvent method
                      // so we need to call the tracker globally

                      // find the tracking function name
                      var trackerfn = tracker.id.replace(
                        "_" + tracker.namespace,
                        ""
                      );
                      if (state.sendEvent && typeof window[trackerfn] === f) {
                        window[trackerfn]("trackSelfDescribingEvent", {
                          event: payload(),
                        });
                      }

                      if (state.callback) callback(token);
                    };

                    if (opts.hCaptcha) {
                      var div = document.createElement("div");
                      div.style.display = "none";
                      document.body.appendChild(div);
                      var widgetId = gr.render(div, {
                        sitekey: state.siteKey,
                        size: "invisible",
                        callback: handler,
                      });

                      state.challenge_ts = new Date();
                      gr.execute(widgetId, { action: state.action });
                    } else
                      gr.ready(function () {
                        state.challenge_ts = new Date();
                        gr.execute(state.siteKey, {
                          action: state.action,
                        }).then(handler);
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

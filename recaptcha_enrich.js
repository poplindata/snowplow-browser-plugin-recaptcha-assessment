/*=== Configuration ===*/
var config = {
  secretKey: "CHANGEME",
  enterprise: false,
  hCaptcha: false,
  gcpProject: null,
  gcpServiceAccount: "default",
  gcpMetaDataApi: "http://metadata.google.internal/computeMetadata/v1",
  failOnError: false,
};
/*=== /Configuration ===*/

var process = (function (options, JSON, String, java) {
  // we wrap all the setup so the minifier can mangle
  var secretKey = options.secretKey;
  var enterprise = !!options.enterprise;
  var hCaptcha = !!options.hCaptcha;
  var gcpProject = options.gcpProject;

  var vendor = hCaptcha ? "com.hcaptcha" : "com.google.recaptcha";
  var schemaName = hCaptcha ? "challenge" : "action";
  var outputName =
    enterprise && !hCaptcha ? "enterprise_assessment" : "assessment";
  var outputVersion = "1-0-0";

  var endpoint = enterprise
    ? "https://recaptchaenterprise.googleapis.com/$VERSION/projects/$PROJECT/assessments"
    : hCaptcha
    ? "https://hcaptcha.com/siteverify"
    : "https://www.google.com/recaptcha/api/siteverify";

  var assessFn =
    enterprise && !hCaptcha ? assessEnterpriseAction : assessAction;

  var accessToken = null;
  var accessTokenExpiry = +new Date();

  function findAction(sdjArray) {
    var target = ["iglu:" + vendor, schemaName, "jsonschema", ""].join("/");
    var needles = sdjArray.filter(function (sdj) {
      return sdj && sdj.schema && sdj.schema.indexOf(target) === 0;
    });
    return needles.length ? needles[0] : null;
  }

  function assessAction(action, ip, ua) {
    var params = {
      remoteip: ip,
      response: action.data.token,
      secret: secretKey,
      sitekey: hCaptcha ? action.data.site_key : undefined,
    };
    return JSON.parse(apiRequest(endpoint, {}, {}, params));
  }

  function assessEnterpriseAction(action, ip, ua) {
    gcpProject = gcpProject || discoverProject();

    if (!gcpProject) throw "Could not determine GCP project.";
    var api = endpoint.replace("$PROJECT", gcpProject);

    var payload = {
      expectedAction: action.data.action,
      siteKey: action.data.site_key,
      token: action.data.token,
      userAgent: ua,
      userIpAddress: ip,
    };

    if (!secretKey || secretKey === "CHANGEME") {
      api = api.replace("$VERSION", "v1");

      var now = +new Date();
      if (!accessToken || now > accessTokenExpiry - 30000) {
        discoverAccessToken();
      }

      if (!accessToken) throw "Unable to find access token";

      return JSON.parse(
        apiRequest(
          api,
          {
            Authorization: "Bearer " + accessToken,
          },
          {},
          JSON.stringify({ event: payload })
        )
      );
    } else {
      api = api.replace("$VERSION", "v1beta1");
      return JSON.parse(
        apiRequest(
          api,
          {},
          { key: secretKey },
          JSON.stringify({ event: payload })
        )
      );
    }
  }

  function discoverProject() {
    var project = apiRequest(options.gcpMetaDataApi + "/project/numeric-project-id", {
      "Metadata-Flavor": "Google",
    });

    if (project) gcpProject = project;
    return gcpProject;
  }

  function discoverAccessToken() {
    var saUrl = [
      options.gcpMetaDataApi + "/v1/instance/service-accounts",
      options.gcpServiceAccount,
      "token",
    ].join("/");
    var token = JSON.parse(apiRequest(saUrl, { "Metadata-Flavor": "Google" }));
    if (token && token.access_token) {
      accessToken = token.access_token;
      accessTokenExpiry = +new Date() + token.expires_in;
      return token.access_token;
    }
  }

  function buildParams(kv) {
    if (kv == null || typeof kv !== "object") return "";
    var res = [];

    for (var p in kv) {
      if (kv.hasOwnProperty(p) && kv[p] != null) {
        res.push([encodeURIComponent(p), encodeURIComponent(kv[p])].join("="));
      }
    }

    return res.join("&");
  }

  function apiRequest(endpoint, headers, params, body) {
    var paramStr = buildParams(params);
    var url = new java.net.URL(paramStr ? endpoint + "?" + paramStr : endpoint);

    var urlConn = url.openConnection();
    if (body || paramStr) urlConn.setRequestMethod("POST");

    if (headers != null) {
      for (var p in headers) {
        if (headers.hasOwnProperty(p)) {
          urlConn.setRequestProperty(p, headers[p]);
        }
      }
    }

    try {
      if (body) {
        if (typeof body === "string") {
          urlConn.setRequestProperty("Content-Type", "application/json");
        } else {
          body = buildParams(body);
        }

        urlConn.setDoOutput(true);
        var sw = new java.io.OutputStreamWriter(urlConn.getOutputStream());
        sw.write(body);
        sw.close();
      }

      var sr = new java.io.InputStreamReader(urlConn.getInputStream());
      var buffReader = new java.io.BufferedReader(sr);

      var content = "";
      while ((line = buffReader.readLine()) != null) {
        content += String(line);
      }
      buffReader.close();

      return content;
    } catch (e) {
      throw e;
    }
  }

  return function process(event) {
    var contexts = [];

    try {
      var ctx = JSON.parse(event.getContexts() || JSON.stringify({ data: [] }));
      var ue = JSON.parse(event.getUnstruct_event() || "{}");
      ctx.data.push(ue.data);

      var action = findAction(ctx.data);
      if (!action) return;

      var ip = String(event.getUser_ipaddress());
      var ua = String(event.getUseragent());

      contexts.push({
        schema: [
          "iglu:" + vendor,
          outputName,
          "jsonschema",
          outputVersion,
        ].join("/"),
        data: assessFn(action, ip, ua),
      });
    } finally {
      if (!config.failOnError) {
        return contexts;
      }
    }

    return contexts;
  };
})(config, JSON, String, java);

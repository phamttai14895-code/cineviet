/**
 * Parse VAST 2/3/4 XML (InLine) — lấy media URL, impression, tracking events, click-through.
 * Chỉ xử lý một Ad đầu tiên, Creative Linear đầu tiên.
 */

function textContent(el) {
  if (!el) return '';
  return (el.textContent || '').trim();
}

function collectUrls(node, tagName) {
  if (!node) return [];
  const list = node.getElementsByTagName(tagName);
  return Array.from(list).map((n) => textContent(n)).filter(Boolean);
}

function getTrackingEvents(creative) {
  const events = {};
  const tracking = creative?.getElementsByTagName('TrackingEvents')?.[0];
  if (!tracking) return events;
  const elements = tracking.getElementsByTagName('Tracking');
  for (const el of elements) {
    const eventName = (el.getAttribute('event') || '').toLowerCase();
    const url = textContent(el);
    if (eventName && url) {
      if (!events[eventName]) events[eventName] = [];
      events[eventName].push(url);
    }
  }
  return events;
}

function getMediaFile(creative) {
  const mediaFiles = creative?.getElementsByTagName('MediaFiles')?.[0];
  if (!mediaFiles) return null;
  const files = mediaFiles.getElementsByTagName('MediaFile');
  for (const f of files) {
    const type = (f.getAttribute('type') || '').toLowerCase();
    const delivery = (f.getAttribute('delivery') || 'progressive').toLowerCase();
    if ((type.includes('mp4') || type === 'video/mp4') && (delivery === 'progressive' || !f.hasAttribute('delivery'))) {
      return textContent(f);
    }
  }
  if (files.length > 0) return textContent(files[0]);
  return null;
}

function getVideoClicks(creative) {
  const clicks = creative?.getElementsByTagName('VideoClicks')?.[0];
  if (!clicks) return { clickThrough: null, clickTracking: [] };
  const ct = clicks.getElementsByTagName('ClickThrough')?.[0];
  const clickThrough = ct ? textContent(ct) : null;
  const tracking = collectUrls(clicks, 'ClickTracking');
  return { clickThrough, clickTracking: tracking };
}

/**
 * Parse VAST XML string. Trả về { mediaUrl, impressionUrls, tracking, clickThrough } hoặc null.
 */
export function parseVastXml(xmlString) {
  if (!xmlString || typeof xmlString !== 'string') return null;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    const ad = doc.getElementsByTagName('Ad')?.[0];
    if (!ad) return null;

    const inLine = ad.getElementsByTagName('InLine')?.[0];
    const wrapper = ad.getElementsByTagName('Wrapper')?.[0];
    let creative;
    let impressionUrls = [];
    let tracking = {};
    let clickThrough = null;

    let clickTracking = [];
    if (inLine) {
      impressionUrls = collectUrls(inLine, 'Impression');
      creative = inLine.getElementsByTagName('Creative')?.[0]?.getElementsByTagName('Linear')?.[0];
      if (creative) {
        tracking = getTrackingEvents(creative);
        const clicks = getVideoClicks(creative);
        clickThrough = clicks.clickThrough;
        clickTracking = clicks.clickTracking || [];
      }
    } else if (wrapper) {
      impressionUrls = collectUrls(wrapper, 'Impression');
      const vastAdTagUri = wrapper.getElementsByTagName('VASTAdTagURI')?.[0];
      if (vastAdTagUri) {
        const uri = textContent(vastAdTagUri);
        if (uri) return { wrapperUrl: uri, impressionUrls, tracking: {}, clickThrough: null, clickTracking: [] };
      }
      creative = wrapper.getElementsByTagName('Creative')?.[0]?.getElementsByTagName('Linear')?.[0];
      if (creative) {
        tracking = getTrackingEvents(creative);
        const clicks = getVideoClicks(creative);
        clickThrough = clicks.clickThrough;
        clickTracking = clicks.clickTracking || [];
      }
    }

    const mediaUrl = creative ? getMediaFile(creative) : null;
    if (!mediaUrl && !inLine && wrapper?.getElementsByTagName('VASTAdTagURI')?.length) {
      return null;
    }
    return { mediaUrl, impressionUrls, tracking, clickThrough, clickTracking };
  } catch {
    return null;
  }
}

/**
 * Gọi tracking URLs (pixel) — dùng fetch hoặc Image để báo hiệu.
 */
export function fireTrackingUrls(urls) {
  if (!urls?.length) return;
  urls.forEach((url) => {
    try {
      if (typeof fetch !== 'undefined') {
        fetch(url, { mode: 'no-cors' }).catch(() => {});
      } else {
        const img = new Image();
        img.src = url;
      }
    } catch (_) {}
  });
}

/**
 * Lấy VAST từ URL (XML), parse và trả về dữ liệu quảng cáo đầu tiên.
 * Nếu là Wrapper và có wrapperUrl thì không tự resolve (caller có thể gọi lại với wrapperUrl).
 */
export async function fetchVast(vastUrl) {
  if (!vastUrl || typeof vastUrl !== 'string') return null;
  try {
    const res = await fetch(vastUrl);
    const text = await res.text();
    const parsed = parseVastXml(text);
    if (parsed?.wrapperUrl) {
      const next = await fetchVast(parsed.wrapperUrl);
      if (next) return next;
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

import React from 'react';

/**
 * Tách chuỗi thông báo thành text + link: URL (http/https) thành thẻ <a> click được.
 * VD: "Ủng hộ tại đây: https://comicviet.live" → [ "Ủng hộ tại đây: ", <a>https://comicviet.live</a> ]
 */
export function noticeWithLinks(text) {
  if (!text || typeof text !== 'string') return null;
  const urlRegex = /https?:\/\/[^\s<>"']+/gi;
  const parts = text.split(urlRegex);
  const matches = text.match(urlRegex) || [];
  const result = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) result.push(parts[i]);
    if (i < matches.length) {
      const url = matches[i].replace(/[.,;:]+$/, '');
      result.push(
        <a
          key={`link-${i}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="notice-link"
        >
          {url}
        </a>
      );
    }
  }
  return result.length ? result : text;
}

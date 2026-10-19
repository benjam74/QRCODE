import { escapeHtml as e } from '../http/html.ts';
import type { CardFull } from '../cards/types.ts';

export function signatureHtml(card: CardFull, baseUrl: string): string {
  const url = `${baseUrl}/c/${card.slug}`;
  const name = `${card.firstName} ${card.lastName}`.trim();
  const titles = [card.titleLine1, card.titleLine2].filter((s) => s.trim()).map(e).join('<br>');
  const accent = /^#[0-9a-fA-F]{6}$/.test(card.accentColor) ? card.accentColor : '#1F4E79';
  const photo = card.photoFile
    ? `<td style="padding:0 14px 0 0;vertical-align:top;"><img src="${e(`${baseUrl}/media/${card.photoFile}`)}" width="64" height="64" alt="${e(name)}" style="display:block;border-radius:32px;width:64px;height:64px;"></td>`
    : '';
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.4;color:#1d1f22;"><tr>${photo}<td style="vertical-align:top;padding:0 14px 0 0;"><strong style="font-size:15px;">${e(name)}</strong><br><span style="color:#5b6168;">${titles}</span><br><a href="${e(url)}" style="color:${accent};font-weight:bold;text-decoration:none;">Ma carte de visite</a></td><td style="vertical-align:top;"><a href="${e(url)}"><img src="${e(`${url}/qr.png`)}" width="80" height="80" alt="QR code de la carte de visite" style="display:block;width:80px;height:80px;"></a></td></tr></table>`;
}

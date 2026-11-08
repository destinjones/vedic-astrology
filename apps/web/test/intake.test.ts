import { describe, expect, it } from 'vitest';
import { isReplyHash, parseReply, parseRequest, replyLink, replyMessage, requestLink, splitQuestions, type IntakeReply } from '../src/lib/intake';
import { parseShareHash } from '../src/lib/profiles';

const ROOT = 'https://example.org/vedic-astrology/';
const reply: IntakeReply = {
  input: { name: 'Priya Rao', date: '1991-04-12', time: '05:40', place: 'Chennai, India', latitude: 13.0827, longitude: 80.2707, timezone: 'Asia/Kolkata', ayanamsa: 'lahiri', timeConfidence: 'approximate' },
  questions: ['When will I change jobs?', 'Is 2027 good for marriage & a move?'],
  contact: '+91 98765 43210',
  to: 'Pandit Sharma',
  sentOn: '2026-11-08',
};

describe('intake request link', () => {
  it('carries the astrologer after the #, and reads back', () => {
    const link = requestLink({ from: 'Pandit Sharma', email: 'pandit@example.org', message: 'See you Friday' }, ROOT);
    expect(link.startsWith(`${ROOT}intake/#`)).toBe(true);
    expect(parseRequest(new URL(link).hash)).toEqual({ from: 'Pandit Sharma', email: 'pandit@example.org', message: 'See you Friday' });
  });
  it('drops a malformed email and leaves an empty request bare', () => {
    expect(parseRequest('#a=X&e=not-an-email').email).toBe('');
    expect(requestLink({ from: '', email: '', message: '' }, ROOT)).toBe(`${ROOT}intake/`);
  });
});

describe('intake reply link', () => {
  it('round-trips birth details, questions and contact', () => {
    const link = replyLink(reply, ROOT);
    expect(link.startsWith(`${ROOT}app/#intake&v=`)).toBe(true);
    expect(isReplyHash(new URL(link).hash)).toBe(true);
    expect(parseReply(link)).toEqual(reply);
  });
  it('finds the link inside a pasted message, even wrapped in <...>', () => {
    const link = replyLink(reply, ROOT);
    expect(parseReply(replyMessage(reply, link))?.questions).toEqual(reply.questions);
    expect(parseReply(`Hi!\n<${link}>\nThanks`)?.input.name).toBe('Priya Rao');
  });
  it('rejects a link cut off before the birth details are complete', () => {
    const link = replyLink(reply, ROOT);
    expect(parseReply(link.slice(0, link.indexOf('&lat=')))).toBeNull();
    expect(parseReply('no link here')).toBeNull();
  });
  it('still opens as a plain chart where only share links are understood', () => {
    expect(parseShareHash(new URL(replyLink(reply, ROOT)).hash.replace(/^#intake&/, '#'))?.date).toBe('1991-04-12');
  });
});

describe('splitQuestions', () => {
  it('takes one question per line and strips list markers', () => {
    expect(splitQuestions('1. Career?\n\n- Marriage?\n  • Health?  ')).toEqual(['Career?', 'Marriage?', 'Health?']);
  });
});

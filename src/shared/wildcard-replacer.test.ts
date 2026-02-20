import { describe, it, expect } from 'vitest';
import { replaceWildcards, WildcardContext } from './wildcard-replacer';

const ctx: WildcardContext = {
  agentName: 'bold-falcon',
  standbyBranch: 'bold-falcon/standby',
  agentPath: '.clubhouse/agents/bold-falcon/',
};

describe('replaceWildcards', () => {
  it('replaces @@AgentName', () => {
    expect(replaceWildcards('Hello @@AgentName!', ctx)).toBe('Hello bold-falcon!');
  });

  it('replaces @@StandbyBranch', () => {
    expect(replaceWildcards('Branch: @@StandbyBranch', ctx)).toBe('Branch: bold-falcon/standby');
  });

  it('replaces @@Path', () => {
    expect(replaceWildcards('Scope to @@Path', ctx)).toBe('Scope to .clubhouse/agents/bold-falcon/');
  });

  it('replaces multiple wildcards on the same line', () => {
    const input = '@@AgentName on branch @@StandbyBranch at @@Path';
    expect(replaceWildcards(input, ctx)).toBe(
      'bold-falcon on branch bold-falcon/standby at .clubhouse/agents/bold-falcon/',
    );
  });

  it('replaces multiple occurrences of the same wildcard', () => {
    expect(replaceWildcards('@@AgentName and @@AgentName', ctx)).toBe(
      'bold-falcon and bold-falcon',
    );
  });

  it('returns text unchanged when no wildcards are present', () => {
    const input = 'No wildcards here';
    expect(replaceWildcards(input, ctx)).toBe(input);
  });

  it('handles wildcards inside JSON strings', () => {
    const json = '{"allow": ["Read(@@Path**)", "Edit(@@Path**)"]}';
    expect(replaceWildcards(json, ctx)).toBe(
      '{"allow": ["Read(.clubhouse/agents/bold-falcon/**)", "Edit(.clubhouse/agents/bold-falcon/**)"]}',
    );
  });

  it('handles empty string', () => {
    expect(replaceWildcards('', ctx)).toBe('');
  });

  it('handles multiline text', () => {
    const input = 'Name: @@AgentName\nBranch: @@StandbyBranch\nPath: @@Path';
    expect(replaceWildcards(input, ctx)).toBe(
      'Name: bold-falcon\nBranch: bold-falcon/standby\nPath: .clubhouse/agents/bold-falcon/',
    );
  });
});

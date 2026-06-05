import { describe, expect, it } from 'vitest';
import { applyProductFactGuard } from '@/lib/productFactGuards';

describe('product fact guards', () => {
  it('replaces easyTag drafts that incorrectly say no charger is included', () => {
    const result = applyProductFactGuard({
      latestCustomerMessage: 'Do they come with a charger usb lead',
      customerContext: 'Do they come with a charger usb lead',
      aiReply: 'The easyTag Apple Wallet Tracker does not come with a separate charger USB lead.',
      confidence: 25,
      confidenceReason: 'no approved knowledge match',
    });

    expect(result?.reply).toContain('each easyTag comes with its own magnetic charger');
    expect(result?.reply).toContain('not a wireless charging pad');
    expect(result?.confidence).toBe(92);
    expect(result?.confidenceReason).toContain('verified easyTag charger fact guard applied');
  });

  it('uses unresolved thread context when the latest customer message is low-information', () => {
    const result = applyProductFactGuard({
      latestCustomerMessage: 'No reply?',
      customerContext: [
        'Do they come with a charger usb lead',
        'Do these come with a charger lead',
        'No reply?',
      ].join('\n'),
      aiReply: 'The easyTag Apple Wallet Tracker does not include a charger USB lead in the package.',
      confidence: 20,
      confidenceReason: 'recent thread history available',
    });

    expect(result?.reply).toContain('each easyTag comes with its own magnetic charger');
  });

  it('answers package-content questions when the AI asks for unnecessary product confirmation', () => {
    const result = applyProductFactGuard({
      latestCustomerMessage: 'Does this come with charger as well please',
      customerContext: 'Does this come with charger as well please Find My M10 Card Tracker',
      aiReply: 'Could you please confirm which product you are asking about so I can check this for you?',
      confidence: 28,
      confidenceReason: 'no approved knowledge match',
    });

    expect(result?.reply).toContain('each easyTag comes with its own magnetic charger');
  });

  it('keeps accurate easyTag charger drafts unchanged', () => {
    const result = applyProductFactGuard({
      latestCustomerMessage: 'Does the easy tag come with a charger or is that extra?',
      customerContext: 'Does the easy tag come with a charger or is that extra?',
      aiReply: 'Yes, each easyTag card comes with its own charger included in the package.',
      confidence: 90,
      confidenceReason: 'approved knowledge matched',
    });

    expect(result).toBeNull();
  });

  it('does not apply easyTag facts to vehicle tracker wiring questions', () => {
    const result = applyProductFactGuard({
      latestCustomerMessage: 'Does the ReFind GPS Vehicle Tracker come with a battery cable?',
      customerContext: 'ReFind GPS Vehicle Tracker battery cables black and red wires',
      aiReply: 'No, the tracker must be powered using the cables provided and the battery terminals of your vehicle.',
      confidence: 85,
      confidenceReason: 'approved knowledge matched',
    });

    expect(result).toBeNull();
  });

  it('uses French when the easyTag recharge question is French', () => {
    const result = applyProductFactGuard({
      latestCustomerMessage: 'Comment recharger mon easy tag?',
      customerContext: 'Comment recharger mon easy tag?',
      aiReply: 'The easyTag does not require recharging as it uses a built-in battery.',
      confidence: 70,
      confidenceReason: 'approved knowledge matched',
    });

    expect(result?.reply).toContain('Bonjour');
    expect(result?.reply).toContain('chaque easyTag est fourni');
    expect(result?.reply).toContain('chargeur');
  });
});

# WhatsApp CTR Messaging Logic

## Objective

The message has one job: earn a relevant click. It should not explain the full product, close the sale, or read like a miniature product page. The landing page handles conversion.

Primary metric:

`unique tracked clicks / delivered messages`

Read rate is diagnostic. Orders and revenue are downstream checks. Opt-outs, negative replies, delivery failures, and template-quality warnings are safety guardrails.

## Core Shape

Every message follows four beats:

1. **Human opener** - a question, observation, confession, or familiar moment.
2. **Curiosity gap** - leave one honest thing unresolved.
3. **Relevance bridge** - connect the moment to one real easyTag use case without listing benefits.
4. **Low-pressure button** - two to four words that complete the thought.

The preferred body is 20-45 words across two short paragraphs. The first sentence should usually be no more than ten words.

## Creative Lanes

### Travel moment

Start with a specific part of flying or a holiday: packing, check-in, the security tray, baggage reclaim, the hotel-room sweep, or unpacking at home. The scene should be familiar without pretending that the sender knows the recipient's itinerary.

Example:

> Flying anywhere soon?
>
> There is one small bit of travel prep that feels unnecessary right up until it does not.

Button: `See the small thing`

### easy family trust

Use the easy name selectively as a factual reason to trust or investigate easyTag. The accurate relationship is that easyTag and easyJet are both members of the easy family of brands, while remaining separate businesses.

Example:

> You probably know the easy name from easyJet.
>
> easyTag is another member of the easy family of brands, focused on a very travel-relevant problem.

Button: `Meet easyTag`

### Self-test

Ask the reader to check or remember something immediately. The tiny act makes the message personally relevant before easyTag is mentioned.

Example:

> Tiny question: where is your wallet right now?
>
> If that took even a second, you will understand why this exists.

Button: `See why`

### Shared human moment

Describe a specific, lightly emotional scene the reader recognizes. Keep the drama proportionate and allow a little humour.

Example:

> Be honest: how many times do you check the same pocket when your wallet goes missing?
>
> There is a card made for shortening that particular little drama.

Button: `See the card`

### Useful surprise

Lead with a true, non-obvious fact or practical detail. The destination must reveal or demonstrate the promised detail immediately.

Example for a confirmed Samsung audience:

> AirTags get all the attention, but Samsung phones have their own finding network.
>
> The wallet-sized version is worth seeing.

Button: `Show me`

### Identity and recognition

Let the reader recognize their own behaviour without labelling or embarrassing them.

Example:

> Airport security has two groups: the organised, and the suddenly-checking-every-pocket.
>
> We made something for the second group.

Button: `That is me`

### Open loop

Present one credible puzzle whose answer is visible on the destination page. Never use a vague tease that the page does not satisfy.

Example:

> Your wallet is probably exactly where you left it.
>
> The annoying part is proving that to yourself.

Button: `Fix that`

## Audience Relevance

The copy brief must be assembled before writing:

- Known phone ecosystem: Apple, Samsung, or unknown.
- Products already bought, so existing owners are not introduced to the same item as strangers.
- Country and language, used only for relevant wording and valid product availability.
- Safe support status and cooling period.
- Product, guide, or offer that the destination page actually supports.
- Hooks received in the previous 90 days, to prevent creative repetition.

Do not mention private support details, imply surveillance, or use personal information merely because it is available. First-name personalization is optional and should be tested separately from the hook.

## Hard Rejection Rules

Reject a draft when any of these are true:

- It opens with easyTag, a product name, a price, or a discount.
- It contains more than one product, idea, emotion, or call to action.
- It uses catalogue language or stacked features.
- It relies on generic urgency, scarcity, or fear.
- It says `shop now`, `buy now`, `click here`, `do not miss out`, `game changer`, `unlock`, or `exclusive` without a genuine restricted offer.
- It makes a compatibility, range, stock, delivery, or performance claim not grounded in current Shopify/product facts.
- It implies that easyJet owns, operates, sponsors, endorses, supplies, partners with, or shares customer data with easyTag.
- It claims or implies knowledge of a flight, airport, destination, or holiday that is not supported by a reliable targeting signal.
- The linked page does not answer the hook above the fold.
- It sounds like an email subject line, corporate announcement, or inspirational quotation.
- It uses more than one emoji, more than one exclamation mark, or a formal sign-off.
- It asks a question that would naturally invite a support reply when the intended action is a click.

## Candidate Scoring

Generate five candidates from five different creative lanes. Score each blindly from 1-5 on:

- Curiosity: is there a specific reason to continue?
- Recognition: does the moment feel personally familiar?
- Naturalness: could a person plausibly send this on WhatsApp?
- Relevance: does it fit this audience and product?
- Destination match: does the page satisfy the promise immediately?
- Novelty: is it different from recent messages?
- Trust: is it honest, proportionate, and free of pressure?

Reject any candidate scoring below 4 on relevance, destination match, or trust. The winner should have no more than a two-point spread between its highest and lowest score; this prevents a very clever hook from hiding a weak product connection.

## Initial Candidate Set

These are creative directions, not approved or scheduled messages.

| Lane | Body | Button |
| --- | --- | --- |
| Self-test | Tiny question: where is your wallet right now?\n\nIf that took even a second, you will understand why this exists. | See why |
| Humour | Be honest: how many times do you check the same pocket when your wallet goes missing?\n\nThere is a card made for shortening that particular little drama. | See the card |
| Recognition | Airport security has two groups: the organised, and the suddenly-checking-every-pocket.\n\nWe made something for the second group. | That is me |
| Open loop | Your wallet is probably exactly where you left it.\n\nThe annoying part is proving that to yourself. | Fix that |
| Travel curiosity | A suitcase disappearing behind the conveyor belt is a surprisingly large trust exercise.\n\nThere is a small way to make it feel less blind. | See how |
| Useful surprise | AirTags get all the attention, but Samsung phones have their own finding network.\n\nThe wallet-sized version is worth seeing. | Show me |

The recommended first creative is the **self-test**. It creates an immediate personal interaction, avoids sales language, and makes the click a natural completion of the thought.

## Experiment Design

The first 25-person release proves delivery, tracking, destination alignment, and customer reaction; it does not establish a statistically reliable creative winner.

After the safety pilot:

- Compare one changed hook at a time.
- Keep audience rules, product, landing page, send window, and cohort source consistent between variants.
- Randomize eligible recipients into non-overlapping groups.
- Use unique tracked redirect tokens and calculate CTR from delivered messages.
- Do not declare a winner from tiny samples or raw click totals.
- Retire hooks that trigger an opt-out, complaint, misleading-page reaction, or Meta quality warning.

## Release Requirements

No customer campaign can be armed until:

1. The final body and button are approved by the owner.
2. A matching Meta template is approved; existing template bodies cannot be rewritten at send time.
3. The destination page answers the hook above the fold on mobile.
4. A signed per-recipient redirect records a unique click before forwarding to a UTM-tagged destination.
5. An internal preview confirms line breaks, button text, language, and preference link.
6. Automation remains manually locked until the owner explicitly approves the pilot.

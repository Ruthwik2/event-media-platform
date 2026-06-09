const { buildCaptionFromLabels } = require('../src/services/rekognitionService');

describe('buildCaptionFromLabels (AI caption synthesis)', () => {
  test('returns null for empty or non-array input', () => {
    expect(buildCaptionFromLabels([])).toBeNull();
    expect(buildCaptionFromLabels(null)).toBeNull();
    expect(buildCaptionFromLabels(undefined)).toBeNull();
  });

  test('single useful label is capitalized', () => {
    expect(buildCaptionFromLabels(['beach'])).toBe('Beach');
  });

  test('joins multiple labels with commas and trailing "and"', () => {
    expect(buildCaptionFromLabels(['beach', 'sunset', 'ocean'])).toBe(
      'Beach, sunset and ocean'
    );
  });

  test('two labels join with "and" only', () => {
    expect(buildCaptionFromLabels(['mountain', 'snow'])).toBe('Mountain and snow');
  });

  test('drops generic labels like person/human/photo', () => {
    expect(buildCaptionFromLabels(['person', 'human', 'beach'])).toBe('Beach');
  });

  test('returns null when only generic labels are present', () => {
    expect(buildCaptionFromLabels(['person', 'human', 'face'])).toBeNull();
  });

  test('caps at the four highest-confidence labels', () => {
    const caption = buildCaptionFromLabels(['a', 'b', 'c', 'd', 'e', 'f']);
    // 4 labels → "A, b, c and d"
    expect(caption).toBe('A, b, c and d');
  });
});

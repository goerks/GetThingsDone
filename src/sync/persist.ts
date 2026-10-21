import type { Repository } from '../data/repository';
import { LABELS_FIELD_ID, type SyncPlan } from '../domain/sync';
import type { Epic, FieldDefinition, Release, Story } from '../domain/types';

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Writes what a sync changed: the labels field, then new stories, then the changed ones with their criteria and values.
 * `before` is what the repository holds now, `plan` what the sync made of it.
 */
export async function persistSync(
  repo: Repository,
  before: { stories: readonly Story[]; fields: readonly FieldDefinition[]; epics?: readonly Epic[]; releases?: readonly Release[] },
  plan: SyncPlan
): Promise<void> {
  // Epics and releases the sync made come first: the stories point to them.
  for (const epic of plan.epics) if (!(before.epics ?? []).some((item) => item.id === epic.id)) await repo.addEpic(epic);
  for (const release of plan.releases) if (!(before.releases ?? []).some((item) => item.id === release.id)) await repo.addRelease(release);
  const labels = plan.fields.find((field) => field.id === LABELS_FIELD_ID);
  const hadLabels = before.fields.find((field) => field.id === LABELS_FIELD_ID);
  if (labels && !sameJson(labels, hadLabels)) {
    await repo.saveField(labels);
    await repo.saveAssignments(
      labels.id,
      plan.assignments.filter((item) => item.fieldId === labels.id)
    );
  }
  const old = new Map(before.stories.map((story) => [story.id, story]));
  for (const story of plan.stories) {
    const was = old.get(story.id);
    if (!was) {
      await repo.addStory(story);
      continue;
    }
    if (story === was) continue;
    if (story.title !== was.title || story.description !== was.description || story.status !== was.status || story.epicId !== was.epicId || story.releaseId !== was.releaseId || !sameJson(story.link, was.link)) {
      await repo.updateStory(story);
    }
    for (const criterion of was.criteria) {
      if (!story.criteria.some((item) => item.id === criterion.id)) await repo.deleteCriterion(criterion.id);
    }
    for (const [position, criterion] of story.criteria.entries()) {
      const had = was.criteria.find((item) => item.id === criterion.id);
      if (!had) await repo.addCriterion(story.id, criterion, position);
      else if (had.done !== criterion.done) await repo.setCriterionDone(criterion.id, criterion.done);
    }
    if (!sameJson(story.criteria.map((item) => item.id), was.criteria.map((item) => item.id))) {
      await repo.saveCriteriaOrder(
        story.id,
        story.criteria.map((item) => item.id)
      );
    }
    const labelValue = story.values[LABELS_FIELD_ID];
    if (!sameJson(labelValue, was.values[LABELS_FIELD_ID])) await repo.setFieldValue(story.id, LABELS_FIELD_ID, labelValue ?? null);
  }
}

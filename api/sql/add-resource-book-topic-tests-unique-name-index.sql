-- A topic can legitimately contain several sub-topics (topic_name) that each restart
-- test numbering (e.g. two different sub-topics both having a "Test 1"), so uniqueness
-- must include topic_name, not just topic_id + name.
CREATE UNIQUE INDEX UX_ResourceBookTopicTests_TopicId_TopicName_Name ON dbo.ResourceBookTopicTests (topic_id, topic_name, name);
GO

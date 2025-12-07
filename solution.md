# Documenting my solution

## Initial Thoughts

This looks like a pretty tough problem - the db schema is a bit more complex than I am used to and am unfamiliar with EAV patterns. I think part one is within my capabilities but I'm less convinced about parts two and three.

## Part One

There's some ambiguity in what counts as the first transition. The DB schema document mentions `To Do → In Progress → Done` but also mentions `Previous status (NULL for first transition)`
I figured I should work under the assumption that first transition means first entry in `ticketing_cycle_time_histories` (as soon as a ticket enters todo we are counting down to meet the SLA) - but obviously in a real work environment this would need to be clarified before even starting work.

The instructions were very specific about how to approach this first part - and I was given a lot of boilerplate so I figured it was best not to deviate too far from the existing apis. Given the existing repository pattern being used I figured I should extend `MatterRepo` to allow the SLA calculation. I also noted that we were only enriching a slice of rows (thanks to the existing pagination) so I was really looking at a `Paginated Amount + 1` performance issue - fine by me. Although I got a sinking feeling that this was going to be an issue when I needed to sort by resolution time. I decided to work within the defined scope for now - not being sure how much I was going to get done in the allocated time.

What I needed to do seemed simple: - Find which status groups are in sequence 3 - Find which status ids are in these status groups - Find the **first** entry in `ticketing_cycle_time_histories` that has one of these ids - Compare it to the **first transition** in `ticketing_cycle_time_histories` - Check if it meets SLA requirement

I did use AI (ChatGPT) to help a bit with the CTEs as I typically have worked within ORMs and as such haven't written loads of raw SQL.
Once I had that sorted it was reasonably easy to figure out the required joins. However this left me with `Postgres Interval` field types which I was unfamiliar with. A bit of research indicated that this was not a reliable way to measure ms time differences so I reached for ChatGPT again to figure out the `ROUND(EXTRACT(EPOCH FROM (fd.first_done_at - ft.first_transition_at)) * 1000)` part of the query

I had knocked out a codewars problem quite recently that was very similar to \_formatDuration and was reasonably confident of my solution (spoiler - this would come back to bite me).

The front end work was trivial - I wasn't sure how much of a refactor was expected but I did end up making a Badge (basically just a span with some predefined styling) component - I thought the existing helper functions were fine and was happy to include the tw output as an 'additional class name' prop.

I debated over adding tests at this stage but at 2-3 hours in I was hungry for a meatier problem and decided to move on. I wasn't too fussed with performance as noted earlier we were only enriching a slice of matters - and I only know about things like Materialized Views in the very abstract. Although I did note that perhaps denormalizing here is a good call. Something like adding `first_transition_at` and `first_done_at` fields to the matters themselves and either using DB triggers or just relying on the backend could save a lot of pain later on when dealing with both searches and joins for sorting.

## Part Two

The biggest challenge here was wrapping my head around the EAV pattern. I probably spent a solid 40 minutes re-reading the Database Schema document, and digging around in psql to make sure I understood how it worked. Reaching for chatGPT again probably worked against me as I lead myself down a path of trying to piece together the custom fields in a big jsonb object within the SQL query itself and it got out of hand pretty quickly.

Thinking about how to approach it a bit more sensibly I came up with: - Query `ticketing_fields` by sortBy (the name of the field) and extract the field type and id - Use an object/map to store different orderBy query strings against the field types - Only join the ` ticketing_ticket_field_value` table on the extracted field id - Should work fine.
I began testing this out on simple things like the text and number field and was pretty happy with how it was working but I started to hit some snags with status and user. I realized that some fields (status, select, and user) were going to need additional joins so I moved away from the object approach and instead wrote a helper function (with a little help from chatGPT out of pure laziness if I'm being honest). The helper function returned an object with an orderBy string and a Join string allowing me to write a cleaner query

```ts
const { orderByExpr, joinSql } = this.buildSortSql(fieldType);
fieldJoinQuery += joinSql;
orderByClause = `${orderByExpr} ${sortOrder.toUpperCase()} NULLS LAST`;
//   ..
const mattersQuery = `
        SELECT
          tt.id,
          tt.board_id,
          tt.created_at,
          tt.updated_at
        FROM ticketing_ticket tt
        ${fieldJoinQuery}
        WHERE 1=1 ${searchCondition}
        ORDER BY ${orderByClause}
        LIMIT $${queryParams.length + 1}
        OFFSET $${queryParams.length + 2}
      `;
```

Again I was happy enough to leave the excess joins to the matter enrichment because it was only happening on 10-25 matters - not worth the trade off of joining everything at this stage.
Although I again wondered about how the next part would impact my solution.

This was working for all custom fields although I was hitting an issue with sorting by Due Date. I probably burnt another 30-40 minutes debugging my query before I realized there was a bug in ` _formatDuration`, and I kicked myself for not jumping on unit testing sooner. It was also at this point that I realized I'll probably have to repeat some logic to sort by duration time, and perhaps some of the challenge in this exercise lay in thinking and reading ahead.

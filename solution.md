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

This was working for all custom fields although I was hitting an issue with sorting by Due Date. I probably burnt another 30-40 minutes debugging my query before I realized there was a bug in ` _formatDuration`, and I kicked myself for not jumping on unit testing sooner.

With the bug fixed and a failsafe built in `_formatDuration` ended up looking like this

```ts
  private _formatDuration(_durationMs: number, _isInProgress: boolean): string {
    try {
      // for readability rather than neccesity
      const msInSecond = 1000;
      const msInMinute = msInSecond * 60;
      const msInHour = msInMinute * 60;
      const msInDay = 24 * msInHour;
      const d = Math.floor(_durationMs / msInDay);
      let remainder = _durationMs % msInDay;
      const h = Math.floor(remainder / msInHour);
      remainder %= msInHour;
      const m = Math.floor(remainder / msInMinute);
      remainder %= msInMinute;
      const s = Math.floor(remainder / msInSecond);
      // probably no need to be accurate to ms

      const [largest, next] = Object.entries({ d, h, m, s }).filter((entry) => entry[1] > 0);

      let subString;

      const [largestUnit, luAmount] = largest;
      const [nextUnit, nuAmount] = next ?? ['', ''];

      if (largestUnit === 'd' && luAmount > 5) {
        subString = '5d+';
      } else {
        subString = (luAmount + largestUnit + ' ' + nuAmount + nextUnit).trim();
      }
      return `${_isInProgress ? 'In Progress: ' : ''}${subString}`;
    } catch (e) {
      logger.error(e);
      return 'N/A';
    }
  }

  private _formatSLAText(_durationMs: number) {
    return !_durationMs ? 'In Progress' : _durationMs <= this._slaThresholdMs ? 'Met' : 'Breached';
  }
```

We would need to determine an amount to display how many days in duration a ticket was. 5 Seems reasonable to me with an SLA of 8 hours but some of the seeded data had durations over 700 days - possibly a signal that my assumption about first transition might be off.

It was also at this point that I realized I'll probably have to repeat some logic to sort by duration time, and perhaps some of the challenge in this exercise lay in thinking and reading ahead.

Sort by duration or SLA status really meant just adding a couple more options to `buildSortSql` and reusing the query I had created from part one. So I ended up with this

```ts
  // TODO: store types
  private buildSortSql(
    fieldType:
      | 'text'
      | 'number'
      | 'boolean'
      | 'date'
      | 'currency'
      | 'user'
      | 'select'
      | 'status'
      | 'duration'
      | 'sla',
  ): { orderByExpr: string; joinSql: string } {
    switch (fieldType) {
      case 'text':
        return {
          orderByExpr: `ttfv.text_value`,
          joinSql: '',
        };

      case 'number':
        return {
          orderByExpr: `ttfv.number_value`,
          joinSql: '',
        };

      case 'date':
        return {
          orderByExpr: `ttfv.date_value`,
          joinSql: '',
        };

      case 'boolean':
        return {
          orderByExpr: `ttfv.boolean_value`,
          joinSql: '',
        };

      case 'currency':
        return {
          orderByExpr: `(ttfv.currency_value->>'amount')::numeric`,
          joinSql: '',
        };

      case 'user':
        return {
          orderByExpr: `u_sort.last_name`,
          joinSql: `
          LEFT JOIN users u_sort
            ON u_sort.id = ttfv.user_value
        `,
        };

      case 'select':
        return {
          orderByExpr: `
          CASE so.label
            WHEN 'Low' THEN 1
            WHEN 'Medium' THEN 2
            WHEN 'High' THEN 3
            WHEN 'Critical' THEN 4
            ELSE 5
          END
        `,
          joinSql: `
          LEFT JOIN ticketing_field_options so
            ON so.id = ttfv.select_reference_value_uuid
        `,
        };

      case 'status':
        return {
          orderByExpr: `sg.name`,
          joinSql: `
          LEFT JOIN ticketing_field_status_options s
            ON s.id = ttfv.status_reference_value_uuid
          LEFT JOIN ticketing_field_status_groups sg
            ON sg.id = s.group_id
        `,
        };
      case 'duration':
        return {
          orderByExpr: 'COALESCE(ct.cycle_time_to_done, ct.cycle_time_to_now)',
          joinSql: this.buildCycleTimeJoin(),
        };
      case 'sla':
        return {
          orderByExpr: `
            CASE
              WHEN ct.cycle_time_to_done IS NULL THEN 0
              WHEN ct.cycle_time_to_done <= ${this._slaThresholdMs} THEN 1
              ELSE 2
            END
          `,
          joinSql: this.buildCycleTimeJoin(),
        };

      default:
        throw new Error(`Unsupported sort field type: ${fieldType}`);
    }
  }
  private buildCycleTimeJoin(): string {
    return `
    LEFT JOIN (
      WITH
        done_group AS (
          SELECT id FROM ticketing_field_status_groups WHERE sequence = 3
        ),
        done_statuses AS (
          SELECT id FROM ticketing_field_status_options
          WHERE group_id IN (SELECT id FROM done_group)
        ),
        first_transition AS (
          SELECT
            ticket_id,
            MIN(transitioned_at) AS first_transition_at
          FROM ticketing_cycle_time_histories
          GROUP BY ticket_id
        ),
        first_done AS (
          SELECT
            ticket_id,
            MIN(transitioned_at) AS first_done_at
          FROM ticketing_cycle_time_histories
          WHERE to_status_id IN (SELECT id FROM done_statuses)
          GROUP BY ticket_id
        )
      SELECT
        ft.ticket_id,
        ft.first_transition_at,
        fd.first_done_at,
        ROUND(EXTRACT(EPOCH FROM (fd.first_done_at - ft.first_transition_at)) * 1000) AS cycle_time_to_done,
        ROUND(EXTRACT(EPOCH FROM (NOW() - ft.first_transition_at)) * 1000) AS cycle_time_to_now
      FROM first_transition ft
      LEFT JOIN first_done fd ON ft.ticket_id = fd.ticket_id
    ) ct ON ct.ticket_id = tt.id
  `;
  }
```

I'm reasonably pleased with this and it's fast enough with the data set we have. I still think denormalization of the `cycle_time_to_done` and `cycle_time_to_now` fields is the simplest step improving performance. The other option is a materialized view which updates on inserts to `ticketing_cycle_time_histories`

## Part Three

Again some ambiguous instruction here - the comments in matter repo specifically say "use ILIKE" but the ASSESMENT.md says to use pg_trm.
I can start with a search query using ILIKE because it's reasonably trivial. I tested that this would work at all by first completing the front end then using

```sql
 SELECT DISTINCT ttfv.ticket_id
            FROM ticketing_ticket_field_value ttfv
            LEFT JOIN ticketing_field_options so
              ON so.id = ttfv.select_reference_value_uuid
            LEFT JOIN ticketing_field_status_options s
              ON s.id = ttfv.select_reference_value_uuid
            LEFT JOIN ticketing_field_status_groups sg
              ON sg.id = s.group_id
            LEFT JOIN users u
              ON u.id = ttfv.user_value
            WHERE
              ttfv.text_value ILIKE '%' || $1 || '%'
            OR so.label ILIKE '%' || $1 || '%'
            OR sg.name  ILIKE '%' || $1 || '%'
            OR u.last_name ILIKE '%' || $1 || '%'
```

As a query to get ticket Ids and then pass them into the sort query

These are the most likely to be searched fields and it did work reasonably well but it wasn't a complete solution. I also discovered it broke the sorting capabilities - in particular there was an issue with the query parameters and how they were being passed into the count query. I resolved this by moving count to before sort.

At this point I'm running low on time - added a few unit tests for the CycletimeService mostly to show that I could but I'm going to try and knock out a better search implementation before doing any more.

After quite a bit of research on trigrams and a thorough examination of the [pg_tgrm docs](https://www.postgresql.org/docs/current/pgtrgm.html) I wrapped my head around the problem. I got some hints on indexes and optimisation from chatGPT and landed on a much more thorough SQL query

```sql
  WITH
      done_group AS (
        SELECT id
        FROM ticketing_field_status_groups
        WHERE sequence = 3
      ),
      done_statuses AS (
        SELECT id
        FROM ticketing_field_status_options
        WHERE group_id IN (SELECT id FROM done_group)
      ),
      first_transition AS (
        SELECT
          ticket_id,
          MIN(transitioned_at) AS first_transition_at
        FROM ticketing_cycle_time_histories
        GROUP BY ticket_id
      ),
      first_done AS (
        SELECT
          ticket_id,
          MIN(transitioned_at) AS first_done_at
        FROM ticketing_cycle_time_histories
        WHERE to_status_id IN (SELECT id FROM done_statuses)
        GROUP BY ticket_id
      ),
      ticket_cycle_times AS (
        SELECT
          ft.ticket_id,
          ft.first_transition_at,
          fd.first_done_at,
          ROUND(EXTRACT(EPOCH FROM (fd.first_done_at - ft.first_transition_at)) * 1000) AS cycle_time_to_done,
          ROUND(EXTRACT(EPOCH FROM (NOW() - ft.first_transition_at)) * 1000) AS cycle_time_to_now
        FROM first_transition ft
        LEFT JOIN first_done fd ON ft.ticket_id = fd.ticket_id
      )

    SELECT DISTINCT ticket_id FROM (
      SELECT ttfv.ticket_id
      FROM ticketing_ticket_field_value ttfv
      WHERE ttfv.text_value % $1::text

      UNION ALL
      SELECT ttfv.ticket_id
      FROM ticketing_ticket_field_value ttfv
      WHERE ttfv.number_value::text ILIKE '%' || $1 || '%'

      UNION ALL
      SELECT ttfv.ticket_id
      FROM ticketing_ticket_field_value ttfv
      LEFT JOIN ticketing_field_options so ON so.id = ttfv.select_reference_value_uuid
      WHERE so.label % $1::text

      UNION ALL
      SELECT ttfv.ticket_id
      FROM ticketing_ticket_field_value ttfv
      LEFT JOIN ticketing_field_status_options s ON s.id = ttfv.select_reference_value_uuid
      LEFT JOIN ticketing_field_status_groups sg ON sg.id = s.group_id
      WHERE s.label % $1::text OR sg.name % $1::text

      UNION ALL
      SELECT ttfv.ticket_id
      FROM ticketing_ticket_field_value ttfv
      LEFT JOIN users u ON u.id = ttfv.user_value
      WHERE (u.first_name || ' ' || u.last_name) % $1::text

      UNION ALL
      SELECT tct.ticket_id
      FROM ticket_cycle_times tct
      WHERE ($1 ILIKE 'In Progress' AND tct.cycle_time_to_done IS NULL)
         OR ($1 ILIKE 'Met' AND tct.cycle_time_to_done <= $2)
         OR ($1 ILIKE 'Breached' AND tct.cycle_time_to_done > $2)
         OR tct.cycle_time_to_done::text ILIKE '%' || $1 || '%'
    ) AS combined

```

Again - there's some repeated logic here, and some room for improvements - I could rank results with `similarity ( text, text ) → real`, for example. Now that I've got comfortable working with `schema.sql` (to add some more indexes) if time permits I'll probably refactor to a Materialized View with some database triggers.

This is thorough enough for my first pass and I want to spend some time writing solid tests.

## Part Four

I had already done some unit tests on `cycle_time_service.ts` and I'm pretty pleased with them but I did note that mocking the `MatterRepo` was clunky. If I was to take ownership over this project I'd be pushing some kind of dependency injection system as a priority.

Tests for `matter_service.ts` didn't really do much except confirm the repo was being called correctly.

However when I started testing `matter_repo.ts` I uncovered some frustrating search behavior.

- When there was no results for a search all records were returned
- Fuzzy search did not work on exact substrings on very long strings

This resulted a quick refactor to the matter repo in yet another refactor to my search query; combining fuzzy search for long search strings with simple substring search for shorter substrings. I used chatgpt here to get the syntax right. A snippet for clarity - and the field where it was most useful:

```sql
      SELECT ttfv.ticket_id
      FROM ticketing_ticket_field_value ttfv
      WHERE
        (length($1) >= 3 AND ttfv.text_value ILIKE '%' || $1 || '%')
        OR (length($1) >= 4 AND ttfv.text_value % $1)
```

This also had the benefit of preventing very short substring matches - leading to too many false positives.

This

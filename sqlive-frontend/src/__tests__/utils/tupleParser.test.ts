import { describe, expect, it } from 'vitest'
import { extractTuplesWithDepth, splitTupleContent } from '@/utils/tupleParser'

describe('extractTuplesWithDepth', () => {
    it('returns no tuples when VALUES is absent or has no opening parenthesis', () => {
        expect(extractTuplesWithDepth('SELECT 1')).toEqual([])
        expect(extractTuplesWithDepth('INSERT INTO t VALUES ?')).toEqual([])
    })

    it('extracts each tuple with offsets that point to its parentheses', () => {
        const sql = "INSERT INTO t VALUES\n (1, 'a'), (2, 'b');"
        const tuples = extractTuplesWithDepth(sql)

        expect(tuples.map((t) => t.content)).toEqual(["1, 'a'", "2, 'b'"])
        expect(tuples.map((t) => sql.slice(t.start, t.end))).toEqual(["(1, 'a')", "(2, 'b')"])
    })

    it('keeps nested calls, quoted parentheses, and doubled quotes inside a tuple', () => {
        const sql = `INSERT INTO t VALUES (COALESCE(NULLIF(1, 2), 3), 'it''s (fine)', "a""b)")`

        expect(extractTuplesWithDepth(sql).map((t) => t.content)).toEqual([
            `COALESCE(NULLIF(1, 2), 3), 'it''s (fine)', "a""b)"`
        ])
    })

    it('ignores an unfinished final tuple without losing earlier complete tuples', () => {
        const sql = "INSERT INTO t VALUES (1), (2, 'unfinished"

        expect(extractTuplesWithDepth(sql).map((t) => t.content)).toEqual(['1'])
    })

    it('ignores comment parentheses and quoted VALUES while retaining raw tuple offsets', () => {
        const sql = `-- VALUES (1, 'a--b')\nINSERT INTO "VALUES" ("VALUES", x) VALUES /* (9) */ (1, 'a--b'), -- (8)\n(2, 'c');`
        const tuples = extractTuplesWithDepth(sql)
        expect(tuples.map((tuple) => sql.slice(tuple.start, tuple.end))).toEqual([
            "(1, 'a--b')",
            "(2, 'c')"
        ])
        expect(tuples[0].start).toBe(sql.indexOf("(1, 'a--b')", sql.indexOf('INSERT')))
    })
})

describe('splitTupleContent', () => {
    it('splits top-level values while retaining commas in functions and strings', () => {
        const content = `COALESCE(NULLIF(1, 2), 3), 'a,b', "x,y", 'it''s, ok', 4`

        expect(splitTupleContent(content)).toEqual([
            'COALESCE(NULLIF(1, 2), 3)',
            "'a,b'",
            '"x,y"',
            "'it''s, ok'",
            '4'
        ])
    })

    it('keeps doubled double quotes and ignores an empty trailing value', () => {
        expect(splitTupleContent('"a""b,c", 2,   ')).toEqual(['"a""b,c"', '2'])
        expect(splitTupleContent('')).toEqual([])
    })

    it('ignores comments without removing comment markers inside literals or identifiers', () => {
        expect(
            splitTupleContent(`1 /* , ) */, 'hello--world', -- ignored, )\n 2, [a,b], \`c,d\``)
        ).toEqual(['1', "'hello--world'", '2', '[a,b]', '`c,d`'])
    })
})

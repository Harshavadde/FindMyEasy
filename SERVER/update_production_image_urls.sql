DO $migration$
DECLARE
    changed_count integer;
BEGIN
    UPDATE listing_images AS img
    SET image_url = src.new_url
    FROM (VALUES
        ('7392453e-f9d5-4a99-a914-27dcc4dff438'::text, '/uploads/listings/37d88ef4-59f9-4d55-ad1b-2b0284c0466d/74dd6588-b1f1-4741-b88f-da492bdbf5ed.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/37d88ef4-59f9-4d55-ad1b-2b0284c0466d/74dd6588-b1f1-4741-b88f-da492bdbf5ed.jpg'),
        ('3e4959cb-d1e1-420c-8cc5-8d2a3648064d'::text, '/uploads/listings/37d88ef4-59f9-4d55-ad1b-2b0284c0466d/067e3c21-9a4a-4d0a-a725-0cecd5a80ccc.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/37d88ef4-59f9-4d55-ad1b-2b0284c0466d/067e3c21-9a4a-4d0a-a725-0cecd5a80ccc.jpg'),
        ('7e91c03f-410d-4347-9db6-5e20abbb037a'::text, '/uploads/listings/37d88ef4-59f9-4d55-ad1b-2b0284c0466d/3a35f378-ac49-4802-942c-f952d6b8c869.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/37d88ef4-59f9-4d55-ad1b-2b0284c0466d/3a35f378-ac49-4802-942c-f952d6b8c869.jpg'),
        ('3d528b27-71d6-4391-a5a1-2bc36794a3ff'::text, '/uploads/listings/37d88ef4-59f9-4d55-ad1b-2b0284c0466d/b2322b5d-43ec-4eae-a351-f7806b24054c.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/37d88ef4-59f9-4d55-ad1b-2b0284c0466d/b2322b5d-43ec-4eae-a351-f7806b24054c.jpg'),
        ('784ef683-f6b4-4116-952a-9eeb0e2e4efc'::text, '/uploads/listings/37d88ef4-59f9-4d55-ad1b-2b0284c0466d/abcf2581-4c68-47e3-b366-cdae2fb9427d.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/37d88ef4-59f9-4d55-ad1b-2b0284c0466d/abcf2581-4c68-47e3-b366-cdae2fb9427d.jpg'),
        ('26ce32ff-8514-4086-926a-9bb32694f358'::text, '/uploads/listings/37d88ef4-59f9-4d55-ad1b-2b0284c0466d/c1a9a2a0-2142-4fb3-85c4-c9ec07748973.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/37d88ef4-59f9-4d55-ad1b-2b0284c0466d/c1a9a2a0-2142-4fb3-85c4-c9ec07748973.jpg'),
        ('136710c9-6b78-46cf-bc4b-4f9489d4f45d'::text, '/uploads/listings/37d88ef4-59f9-4d55-ad1b-2b0284c0466d/7df5f26b-f52e-42d4-8b21-5638a286efaf.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/37d88ef4-59f9-4d55-ad1b-2b0284c0466d/7df5f26b-f52e-42d4-8b21-5638a286efaf.jpg'),
        ('d51291f6-9115-4f8a-a676-80d6f15394ec'::text, '/uploads/listings/37d88ef4-59f9-4d55-ad1b-2b0284c0466d/a13a6da8-0a01-498e-b483-f1c5320cfea2.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/37d88ef4-59f9-4d55-ad1b-2b0284c0466d/a13a6da8-0a01-498e-b483-f1c5320cfea2.jpg'),
        ('ad2d641c-86cc-4582-bca6-dee41948700c'::text, '/uploads/listings/37d88ef4-59f9-4d55-ad1b-2b0284c0466d/ba813399-9f94-49c6-8293-b3be409303be.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/37d88ef4-59f9-4d55-ad1b-2b0284c0466d/ba813399-9f94-49c6-8293-b3be409303be.jpg'),
        ('a7db3c5a-5f84-4648-94cf-712083c49330'::text, '/uploads/listings/37d88ef4-59f9-4d55-ad1b-2b0284c0466d/a8510469-e92f-4622-bee2-7a54f31159b6.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/37d88ef4-59f9-4d55-ad1b-2b0284c0466d/a8510469-e92f-4622-bee2-7a54f31159b6.jpg'),
        ('ac89198c-1790-4384-b10e-6383457c07a2'::text, '/uploads/listings/44efa90a-4fd1-44e2-978d-f6bba550777e/db8e3919-469d-43ba-8bdd-2e297f56d676.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/44efa90a-4fd1-44e2-978d-f6bba550777e/db8e3919-469d-43ba-8bdd-2e297f56d676.jpg'),
        ('2088957c-2ffc-4035-a495-f72d6d6dc50c'::text, '/uploads/listings/44efa90a-4fd1-44e2-978d-f6bba550777e/202d529b-fb3d-41ff-9a3c-ede255696fd9.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/44efa90a-4fd1-44e2-978d-f6bba550777e/202d529b-fb3d-41ff-9a3c-ede255696fd9.jpg'),
        ('1b81c46d-f756-4809-8b2d-e868f61fa0cb'::text, '/uploads/listings/44efa90a-4fd1-44e2-978d-f6bba550777e/2d119f1b-866c-4f44-8c41-aac024a5b8fa.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/44efa90a-4fd1-44e2-978d-f6bba550777e/2d119f1b-866c-4f44-8c41-aac024a5b8fa.jpg'),
        ('9b472f98-6316-4dcc-b188-4195e0c0fc82'::text, '/uploads/listings/8d220785-a77f-4bf4-b40f-e3bf45f98555/78cf777b-9d9d-4e6f-9177-a1d2e09465c6.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/8d220785-a77f-4bf4-b40f-e3bf45f98555/78cf777b-9d9d-4e6f-9177-a1d2e09465c6.jpg'),
        ('b48618a2-f754-4c27-92c8-9a0d76d56bc0'::text, '/uploads/listings/a6cf8039-adc3-4c6f-9a6f-8b45fff32deb/cfe9a8f1-4d94-42c2-b962-6f15e00eb852.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/a6cf8039-adc3-4c6f-9a6f-8b45fff32deb/cfe9a8f1-4d94-42c2-b962-6f15e00eb852.jpg'),
        ('bb5522a4-2464-44a1-9ac1-92b11bfc65b6'::text, '/uploads/listings/a6cf8039-adc3-4c6f-9a6f-8b45fff32deb/ab09d851-0ade-4cf2-ad4a-2bc2643ecbcd.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/a6cf8039-adc3-4c6f-9a6f-8b45fff32deb/ab09d851-0ade-4cf2-ad4a-2bc2643ecbcd.jpg'),
        ('4c24f497-d68e-4f8d-8da5-20a4121a2519'::text, '/uploads/listings/a6cf8039-adc3-4c6f-9a6f-8b45fff32deb/4f366d4b-f181-4b94-b8b4-5d347d3de712.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/a6cf8039-adc3-4c6f-9a6f-8b45fff32deb/4f366d4b-f181-4b94-b8b4-5d347d3de712.jpg'),
        ('b10c159b-e0d0-4e42-8bef-ba789a4bf90e'::text, '/uploads/listings/a6cf8039-adc3-4c6f-9a6f-8b45fff32deb/e5baa933-f57d-48be-bd94-82de09c29a2c.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/a6cf8039-adc3-4c6f-9a6f-8b45fff32deb/e5baa933-f57d-48be-bd94-82de09c29a2c.jpg'),
        ('9a76039a-551b-4539-99c3-2e6487b96509'::text, '/uploads/listings/a6cf8039-adc3-4c6f-9a6f-8b45fff32deb/22306a93-6b9b-4be5-ae29-8fb4002bc0bd.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/a6cf8039-adc3-4c6f-9a6f-8b45fff32deb/22306a93-6b9b-4be5-ae29-8fb4002bc0bd.jpg'),
        ('308bc98e-ebca-43a6-939f-d3a1dfbf1521'::text, '/uploads/listings/a6cf8039-adc3-4c6f-9a6f-8b45fff32deb/2af78cc7-c8ff-415f-9efd-b0e4f0347278.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/a6cf8039-adc3-4c6f-9a6f-8b45fff32deb/2af78cc7-c8ff-415f-9efd-b0e4f0347278.jpg'),
        ('b631aa40-ea44-46d3-b768-c7a1ed842195'::text, '/uploads/listings/d297d1c9-4144-47d3-8646-9fe6d75a8664/97ab859d-cf32-4f5e-a6c6-9fd14b26aa1e.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/d297d1c9-4144-47d3-8646-9fe6d75a8664/97ab859d-cf32-4f5e-a6c6-9fd14b26aa1e.jpg'),
        ('181ad6f1-3823-427e-88fb-8481c34f525c'::text, '/uploads/listings/d297d1c9-4144-47d3-8646-9fe6d75a8664/496677b3-99a6-4618-a59c-8c3c7aaa046e.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/d297d1c9-4144-47d3-8646-9fe6d75a8664/496677b3-99a6-4618-a59c-8c3c7aaa046e.jpg'),
        ('ed59e242-c021-43eb-8889-a5bf71375202'::text, '/uploads/listings/d297d1c9-4144-47d3-8646-9fe6d75a8664/0c19cef7-d0fa-41e7-a7dd-50e1da2b1922.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/d297d1c9-4144-47d3-8646-9fe6d75a8664/0c19cef7-d0fa-41e7-a7dd-50e1da2b1922.jpg'),
        ('e1a0e0d3-9cc0-42fc-9a17-287d90bd58ef'::text, '/uploads/listings/d297d1c9-4144-47d3-8646-9fe6d75a8664/09e0cfbe-567d-4052-84d1-fcdc108a8dd4.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/d297d1c9-4144-47d3-8646-9fe6d75a8664/09e0cfbe-567d-4052-84d1-fcdc108a8dd4.jpg'),
        ('c622567b-b7a8-4be8-9071-94d8787d0f67'::text, '/uploads/listings/d297d1c9-4144-47d3-8646-9fe6d75a8664/10966351-f6cf-448a-b24e-777ff7c5da66.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/d297d1c9-4144-47d3-8646-9fe6d75a8664/10966351-f6cf-448a-b24e-777ff7c5da66.jpg'),
        ('f6bf6602-52db-46ec-87cc-4c963a99e98a'::text, '/uploads/listings/d297d1c9-4144-47d3-8646-9fe6d75a8664/e60a73d4-3682-4692-8493-31731cb4698b.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/d297d1c9-4144-47d3-8646-9fe6d75a8664/e60a73d4-3682-4692-8493-31731cb4698b.jpg'),
        ('2c9b95c1-503c-447f-ae25-14abe55c3799'::text, '/uploads/listings/d297d1c9-4144-47d3-8646-9fe6d75a8664/47665f43-0044-4998-be04-fe9c3af03c42.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/d297d1c9-4144-47d3-8646-9fe6d75a8664/47665f43-0044-4998-be04-fe9c3af03c42.jpg'),
        ('79993ce8-9914-45f0-9102-9ff04abcf4b6'::text, '/uploads/listings/fcb4f413-60d2-4e31-8fce-a393e03f24c4/4f8f78db-68fb-4fce-aeb4-fa345b1b6705.jpg', 'https://br-soft-field-b3tf15e5.storage.c-4.ap-southeast-1.aws.neon.tech/fe-dbimages/hostels/fcb4f413-60d2-4e31-8fce-a393e03f24c4/4f8f78db-68fb-4fce-aeb4-fa345b1b6705.jpg')
    ) AS src(id, old_url, new_url)
    WHERE img.id::text = src.id
      AND img.image_url = src.old_url;

    GET DIAGNOSTICS changed_count = ROW_COUNT;

    IF changed_count <> 28 THEN
        RAISE EXCEPTION
            'Expected 28 updates, but updated % rows. Transaction must be rolled back.',
            changed_count;
    END IF;

    RAISE NOTICE 'Successfully updated % image URLs.', changed_count;
END
$migration$;

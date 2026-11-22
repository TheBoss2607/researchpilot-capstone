from neo4j import GraphDatabase

driver = GraphDatabase.driver(
    "bolt://localhost:7687",
    auth=("neo4j", "Goldfish9")
)

with driver.session() as session:

    print("\n================ USERS ================\n")

    result = session.run("""
        MATCH (u:User)
        RETURN
            u.email AS email,
            u.interests AS interests
        ORDER BY email
    """)

    for record in result:
        print(record.data())


    print("\n========== USER INTEREST RELATIONSHIPS ==========\n")

    result = session.run("""
        MATCH (u:User)-[:U_I_E]->(i)
        RETURN
            u.email AS email,
            labels(i) AS labels,
            i.displayName AS interest
        ORDER BY email, interest
    """)

    for record in result:
        print(record.data())


    print("\n================ LIKED PAPERS ================\n")

    result = session.run("""
        MATCH
            (u:User)
            -[:U_W_E {type:'LIKED'}]->
            (w:Work)

        RETURN
            u.email AS email,
            w.displayName AS paper
        ORDER BY email
    """)

    for record in result:
        print(record.data())


driver.close()
with open('config/kiddoAppConfig.json', 'r') as f:
    text = f.read()

# find first conflict
idx1 = text.find('<<<<<<< HEAD\n')
# find first separating line
idx2 = text.find('\n=======\n', idx1)
# find first end marker
idx3 = text.find('\n>>>>>>> d087fa9 (checkout UI and babycare sidebar)\n', idx2)

# find second conflict
idx4 = text.find('<<<<<<< HEAD\n', idx3)
idx5 = text.find('\n=======\n', idx4)
idx6 = text.find('\n>>>>>>> d087fa9 (checkout UI and babycare sidebar)\n', idx5)

if idx1 == -1 or idx4 == -1:
    print('Could not find both conflict markers precisely.')
    import sys; sys.exit(1)

common_prefix = text[:idx1]

side_a_part1 = text[idx1 + len('<<<<<<< HEAD\n') : idx2]
side_b_part1 = text[idx2 + len('\n=======\n') : idx3]

common_middle = text[idx3 + len('\n>>>>>>> d087fa9 (checkout UI and babycare sidebar)\n') : idx4]

side_a_part2 = text[idx4 + len('<<<<<<< HEAD\n') : idx5]
side_b_part2 = text[idx5 + len('\n=======\n') : idx6]

common_suffix = text[idx6 + len('\n>>>>>>> d087fa9 (checkout UI and babycare sidebar)\n'):]

side_a_full = side_a_part1 + common_middle + side_a_part2
side_b_full = side_b_part1 + common_middle + side_b_part2

# Side A has babygear
# Side B has babycareSidebar, discounts
# Common middle is probably empty or has a few lines
# Let's combine them gracefully:
# common_prefix ends with a comma if it's correct JSON (e.g. before "babygear")
# We want: common_prefix + side_a_full + ',' + side_b_full + common_suffix
# Wait, side_a_full ends with '}'
# Let's clean it up slightly and check commas.

# Let's just create a new string:
merged = common_prefix + side_a_full.rstrip() + ",\n" + side_b_full.lstrip() + common_suffix

with open('config/kiddoAppConfig_fixed2.json', 'w') as f:
    f.write(merged)

print("Merged!")

# Varying cases and flag usage

read readvar readvar readvar
read -r readvar readvar <<< "some output"
echo readvar

read -n1 readvar
read -t 10 readvar
read -rd readvar -p readvar readvar
echo $readvar

read -p readvar -a readvar -er
read -sp "Prompt: " -ra readvar
echo "${readvar[2]}"

read readvar -rp readvar readvar
read -r readvar -p readvar readvar
read -p readvar -ir readvar readvar

# While loop

while read -r readloop; do
	printf readloop
	echo "$readloop"
done < somefile.txt

# Different scopes

read readscope
readfunc() {
	read readscope
	echo $readscope

	local readscope
	read readscope
	echo $readscope
}
(
	echo $readscope

	read readscope
	echo $readscope
)
echo $readscope

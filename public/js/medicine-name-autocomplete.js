$(() => {
    $.getJSON('./data/medicine.json', (data) => {
        let array = $.map(data, (value) => {
            return value.data;
        })

        $('#medicine_name').autocomplete({
            source: (request, response) => {
                let result = $.ui.autocomplete.filter(array, request.term);
                response(result.slice(0, 30));
            }
        });
    });
});
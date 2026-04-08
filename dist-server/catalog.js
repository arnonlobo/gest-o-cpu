export const statusOptions = [
    "Disponível",
    "QCL",
    "Empenhada",
    "Realizando operação",
    "Abastecimento",
    "OS da ADM",
    "Escolta",
    "Delegacia",
    "Hospital",
];
export const resourceTypes = ["RP", "POP", "Moto", "A pé", "Base Comunitária"];
export const sectorCatalog = [
    { cia: "26ª Cia", setor: "Eldorado", bairros: ["Eldorado", "Glória", "Vila Marimbondo"] },
    { cia: "26ª Cia", setor: "JK", bairros: ["JK", "Eldorado"] },
    { cia: "26ª Cia", setor: "Novo Eldorado", bairros: ["Novo Eldorado"] },
    { cia: "26ª Cia", setor: "Parque São João", bairros: ["Parque São João"] },
    {
        cia: "43ª Cia",
        setor: "Cidade Industrial",
        bairros: ["Cidade Industrial", "Vila Samag", "Vila Frigo Diniz", "Vila Aparecida"],
    },
    {
        cia: "43ª Cia",
        setor: "Jardim Industrial",
        bairros: ["Jardim Industrial", "Parque Arrudas", "Vila São Paulo"],
    },
    {
        cia: "43ª Cia",
        setor: "Conjunto Água Branca",
        bairros: ["Conjunto Água Branca", "Darcy Vargas", "Vila Paris"],
    },
    {
        cia: "43ª Cia",
        setor: "Água Branca",
        bairros: ["Água Branca", "Cincão", "Jardim Bandeirantes", "Jardim das Oliveiras"],
    },
    { cia: "132ª Cia", setor: "Industrial", bairros: ["Industrial", "Industrial Itaú"] },
    { cia: "132ª Cia", setor: "Jardim Riacho", bairros: ["Jardim Riacho", "Durval de Barros"] },
    {
        cia: "132ª Cia",
        setor: "Amazonas",
        bairros: ["Amazonas", "Inconfidentes 4ª Seção", "Parque das Mangueiras"],
    },
    { cia: "132ª Cia", setor: "Bandeirantes", bairros: ["Bandeirantes", "Flamengo", "Santa Maria"] },
    { cia: "186ª Cia", setor: "Novo Riacho", bairros: ["Novo Riacho"] },
    { cia: "186ª Cia", setor: "Riacho das Pedras", bairros: ["Riacho das Pedras", "Santa Cruz"] },
    {
        cia: "186ª Cia",
        setor: "Inconfidentes",
        bairros: ["Inconfidentes", "Jardim Vera Cruz", "Jardim Califórnia"],
    },
    {
        cia: "186ª Cia",
        setor: "Monte Castelo",
        bairros: ["Monte Castelo", "Cinco", "Bela Vista", "Beatriz", "Santa Terezinha"],
    },
];
export function getCoverage(cia, setor) {
    return sectorCatalog.find((item) => item.cia === cia && item.setor === setor) || null;
}

# SP: pSeleccionarCobro
**Tipo**: Seleccionar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saDescProntoPago`](../tables/saDescProntoPago.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarCobro
DESCRIPCION: Selecciona un COBRO
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarCobro] ( @sCob_Num CHAR(20) )
AS 
    BEGIN
        SELECT
            C.*, CL.co_tab, Cl.co_cta_ingr_egr, dxpp.hasta1 AS Hasta1, dxpp.Hasta2 AS Hasta2, dxpp.Hasta3 AS Hasta3,
            dxpp.Hasta4 AS Hasta4, dxpp.Hasta5 AS Hasta5, dxpp.porc1 AS Porc1, dxpp.porc2 AS porc2, dxpp.porc3 AS porc3,
            dxpp.porc4 AS porc4, dxpp.porc5 AS porc5, dxpp.porc6 AS porc6, dxpp.tip_Cli AS TipoCliente,
            Cl.desc_ppago AS descProntoPago
        FROM
            saCobro C
            INNER JOIN saCliente Cl ON C.co_cli = Cl.co_cli
            LEFT JOIN saDescProntoPago dxpp ON dxpp.tip_Cli = CL.tip_Cli
        WHERE
            C.cob_num = @sCob_Num
    END
```

# SP: pSeleccionarChequeDevueltoCompra
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saChequeDevueltoCompra`](../tables/saChequeDevueltoCompra.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saPago`](../tables/saPago.md)
- [`saPagoTPReng`](../tables/saPagoTPReng.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarChequeDevueltoCompra
DESCRIPCION: Seleccion de un registro de la tabla bancos
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pSeleccionarChequeDevueltoCompra] ( @sCo_Cheq_Dev CHAR(20) )
AS 
    BEGIN
        SELECT DISTINCT
            ( cd.co_cheq_dev ), cd.*, saCuentaBancaria_1.num_cta AS des_cta, saBanco.des_ban AS des_ban,
            dbo.saPagoTPReng.cob_num AS cob_num, dbo.saPagoTPReng.devuelto AS devuelto,
            dbo.saMovimientoBanco.tasa AS tasa, dbo.saMovimientoBanco.co_cta_ingr_egr AS cta_Egre,
            saCuentaBancaria_1.co_mone AS co_mone, dbo.saPagoTPReng.mov_num_b
        FROM
            saChequeDevueltoCompra AS cd
            INNER JOIN dbo.saProveedor ON dbo.saProveedor.co_prov = cd.co_prov
            INNER JOIN dbo.saPago ON cd.co_prov = dbo.saPago.co_prov
            INNER JOIN dbo.saPagoTPReng ON dbo.saPagoTPReng.cob_num = dbo.saPago.cob_num
                                           AND dbo.saPagoTPReng.num_doc = cd.num_doc AND dbo.saPagoTPReng.forma_pag = 'CH' 
            INNER JOIN dbo.saMovimientoBanco ON dbo.saPagoTPReng.mov_num_b = dbo.saMovimientoBanco.mov_num
            INNER JOIN dbo.saCuentaBancaria AS saCuentaBancaria_1 ON dbo.saPagoTPReng.cod_cta = saCuentaBancaria_1.cod_cta
                                                                     AND dbo.saMovimientoBanco.cod_cta = saCuentaBancaria_1.cod_cta
            INNER JOIN dbo.saBanco ON saCuentaBancaria_1.co_ban = dbo.saBanco.co_ban
            CROSS JOIN dbo.saTipoDocumento
        WHERE
            co_cheq_dev = @sCo_Cheq_Dev     
    END
```

# SP: RepMoviBancoConImagenes
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saBanco`](../tables/saBanco.md)
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saDocumentoImagen`](../tables/saDocumentoImagen.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saMovimientoBanco`](../tables/saMovimientoBanco.md)
- [`saTipoImagen`](../tables/saTipoImagen.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <16/01/2015>
-- Description:	<Movimientos de Bancos Con Imagenes>
-- =============================================
CREATE PROCEDURE [dbo].[RepMoviBancoConImagenes]
       -- Add the parameters for the stored procedure here
    @cCo_Numero_d CHAR(20) = NULL ,
    @cCo_Numero_h CHAR(20) = NULL ,
    @cCo_CodCuenta_d CHAR(6) = NULL ,
    @cCo_CodCuenta_h CHAR(6) = NULL ,
    @cCo_CuentaIngr_d CHAR(20) = NULL ,
    @cCo_CuentaIngr_h CHAR(20) = NULL ,
       @sCo_tipo_img_d char(6) = NULL,
       @sCo_tipo_img_h char(6) = NULL,
    @sFecha_d SMALLDATETIME = NULL ,
    @sFecha_h SMALLDATETIME = NULL ,
    @cTipoMovi CHAR(6) = NULL ,    
    @cMoneda CHAR(6) = NULL ,    
    @cCondicion CHAR(6) = NULL ,
    @cCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
    -- Insert statements for procedure here

        IF @sFecha_d IS NOT NULL 
            SET @sFecha_d = dbo.FechaSimple(@sFecha_d)
        IF @sFecha_h IS NOT NULL 
            SET @sFecha_h = dbo.FechaSimple(@sFecha_h)

/****Valores por defecto****/
        IF ( @cTipoMovi IS NULL ) 
            SET @cTipoMovi = 'TODO'
                    
        IF ( @cCondicion IS NULL ) 
            SET @cCondicion = 'TODO'
/****Valores por defecto****/

        SELECT
            CU.num_cta, CU.inactivo, CU.co_mone, MO.mone_des, BA.co_ban, BA.des_ban, @cCondicion AS Filtro_anulado,
                    (MB.idb + CASE when MB.tipo_op = 'ID' then monto_h + monto_d else 0 end ) * case when MB.monto_d > 0 then 1 else -1 end as idb,
                    MB.monto_h * CASE when MB.tipo_op = 'ID' then 0 else 1 end as monto_h,
             MB.monto_d * CASE when MB.tipo_op = 'ID' then 0 else 1 end as monto_d,
                    MB.*,
                           DI.co_imag, DI.des_imag, DI.picture, TI.co_tipo_imag, TI.descrip as descripImagen
        FROM
            saMovimientoBanco AS MB
            INNER JOIN saCuentaBancaria AS CU ON CU.cod_cta = MB.cod_cta
            INNER JOIN saMoneda AS MO ON MO.co_mone = CU.co_mone
            INNER JOIN saBanco AS BA ON BA.co_ban = CU.co_ban
                    left outer join saDocumentoImagen DI 
                    inner join saTipoImagen TI ON DI.co_tipo_imag = TI.co_tipo_imag ON MB.rowguid = DI.rowguidDoc
        WHERE
```

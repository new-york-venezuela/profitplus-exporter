# SP: pSeleccionarRenglonConsecutivoSucursal
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saConsecutivo`](../tables/saConsecutivo.md)
- [`saConsecutivoTipo`](../tables/saConsecutivoTipo.md)
- [`saSerie`](../tables/saSerie.md)
- [`saSerieTipo`](../tables/saSerieTipo.md)

## Código (excerpt)
```sql
/*********************************************************************************************
*NOMBRE			:	pSeleccionarRenglonConsecutivoSucursal
*DESCRIPCIÓN	:	Selecciona los renglones de la entidad de negocios ConsecutivoSucursal
*CREADO POR		:	SOFTECH SISTEMAS
**********************************************************************************************/

CREATE PROCEDURE [pSeleccionarRenglonConsecutivoSucursal]
    (
      @sCodigo CHAR(20) ,
      @bEsParEmp BIT
    )
AS 
    BEGIN

        DECLARE @var INT ;
        SET @var = 1 ;

        IF ( @bEsParEmp = 1 ) 
            BEGIN
                SELECT
                    @var AS Reng_Num, @bEsParEmp AS EsParEmp, saConsecutivoTipo.des_consecutivo, saSerie.co_serie,
                    saSerieTipo.tipo, saSerie.prox_n, saSerie.prox_a, saConsecutivoTipo.modulo,
                    saConsecutivo.co_emp AS codigo, saConsecutivo.co_consecutivo, saConsecutivo.Revisado,
                    saConsecutivo.Trasnfe, saConsecutivo.co_us_in, saConsecutivo.co_us_mo, saConsecutivo.co_sucu_mo,
                    saConsecutivo.co_sucu_in, saConsecutivo.fe_us_in, saConsecutivo.fe_us_mo, saConsecutivo.validador,
                    saConsecutivo.rowguid
                FROM
                    saConsecutivo
                    INNER JOIN saConsecutivoTipo ON saConsecutivo.co_consecutivo = saConsecutivoTipo.co_consecutivo
                                                    AND saConsecutivoTipo.UsoEmpresa = 1
                    LEFT JOIN saSerie ON saConsecutivo.co_serie = saSerie.co_serie
                    LEFT JOIN saSerieTipo ON saSerie.co_tipo_serie = saSerieTipo.co_tipo_serie
                WHERE
                    saConsecutivo.co_emp = @sCodigo
            END
        ELSE 
            BEGIN
                SELECT
                    @var AS Reng_Num, @bEsParEmp AS EsParEmp, saConsecutivoTipo.des_consecutivo, saSerie.co_serie,
                    saSerieTipo.tipo, saSerie.prox_n, saSerie.prox_a, saConsecutivoTipo.modulo,
                    saConsecutivo.co_sucur AS codigo, saConsecutivo.co_consecutivo, saConsecutivo.Revisado,
                    saConsecutivo.Trasnfe, saConsecutivo.co_us_in, saConsecutivo.co_us_mo, saConsecutivo.co_sucu_mo,
                    saConsecutivo.co_sucu_in, saConsecutivo.fe_us_in, saConsecutivo.fe_us_mo, saConsecutivo.validador,
                    saConsecutivo.rowguid
                FROM
                    saConsecutivo
```

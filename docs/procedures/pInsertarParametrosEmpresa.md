# SP: pInsertarParametrosEmpresa
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pInsertarParametrosEmpresa
*DESCRIPCIÓN	: Inserta una Configuración de empresa en la tabla par_emp
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/
CREATE PROCEDURE [dbo].[pInsertarParametrosEmpresa]
    (
      @sCod_Emp CHAR(20) ,
      @sCod_EmpOri CHAR(20) ,
      @iTab_Num INT = NULL ,
      @sEmp_Imp CHAR(250) = NULL ,
      @sEmp_Adm CHAR(250) = NULL ,
      @bEmp_Sql BIT = NULL ,
      @iVac_Rep_Per INT = NULL ,
      @Logo VARBINARY(MAX) = NULL ,
      @Fecha_Res SMALLDATETIME ,
      @sTemp_Char1 CHAR(20) = NULL ,
      @sTemp_Char2 CHAR(20) = NULL ,
      @sTemp_Char3 CHAR(20) = NULL ,
      @sTemp_Char4 CHAR(20) = NULL ,
      @sTemp_Char5 CHAR(20) = NULL ,
      @sTemp_Char6 CHAR(20) = NULL ,
      @sTemp_Char7 CHAR(20) = NULL ,
      @sTemp_Char8 CHAR(20) = NULL ,
      @Temp_Fech SMALLDATETIME ,
      @iTemp_Num INT ,
      @sServer CHAR(32) ,
      @sNamedb CHAR(32) ,
      @sLogin CHAR(32) ,
      @sPassword CHAR(128) ,
      @tsValidador TIMESTAMP = NULL ,
      @sUrlservidorweb_Cont VARCHAR(128) = NULL ,
      @sUrlservidorweb_Admin VARCHAR(128) = NULL ,
      @sUrlservidorweb_Nom VARCHAR(128) = NULL ,
      @bNetTcp_Admin BIT ,
      @bNetTcp_Cont BIT ,
      @bNetTcp_Nom BIT ,
      @sLogin_Admin CHAR(32) = NULL ,
      @sPassword_Admin CHAR(128) = NULL ,
      @Fec_Cont SMALLDATETIME ,
      @sco_Cue_Aju CHAR(20) = NULL ,
      @iTempor1 INT = NULL ,
      @sG_Moneda CHAR(6) ,
      @bG_Mostrar_Modelo BIT ,
      @bP_Fact_Alm BIT ,
      @bV_Maneja_Sucursales BIT ,
      @bI_Stock_Negativo_Advertencia BIT ,    --INVENTARIO
      @bI_Stock_Negativo BIT ,    --INVENTARIO
      @bI_Precio1_Iva BIT ,
      @bI_Precio2_Iva BIT ,
      @bI_Precio3_Iva BIT ,
      @bI_Precio4_Iva BIT ,
      @bI_Precio5_Iva BIT ,
      @iI_Dec_Stock INT ,	--INVENTARIO
      @iI_Dec_Costo INT ,	--INVENTARIO
      @iI_Dec_Precio INT ,    --INVENTARIO
      @bI_Talla_Articulo BIT ,
      @bI_Multiple_Moneda BIT ,
      @sI_Moneda_Articulo CHAR(6) ,
      @bI_Seriales_Articulo BIT ,    --INVENTARIO
      @bI_Licores BIT ,    --INVENTARIO
      @bI_Lote_Numero BIT ,
      @bI_Lote_Fecha BIT ,
      @iI_Tipo_Inventario INT ,
      @iI_Tipo_Cost_Dev INT ,
      @bI_Maneja_Lotes_Vencidos BIT ,    --INVENTARIO
      @iI_Costo_Inventario INT ,
      @bC_Margen_Co
```
